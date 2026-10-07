package br.com.quizedu.app

import android.app.Application
import android.content.Context
import androidx.compose.ui.test.*
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.graphics.drawable.toBitmap
import coil.ImageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import coil.decode.SvgDecoder
import kotlinx.coroutines.runBlocking
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class NativeUiTest {
    @get:Rule val compose = createComposeRule()
    private lateinit var vm: QuizViewModel
    private lateinit var repository: QuizRepository
    private lateinit var app: Application
    private lateinit var client: FixtureClient
    @Before fun setup() {
        app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application
        app.getSharedPreferences("quizedu_preferences", Context.MODE_PRIVATE).edit().clear().commit()
        app.filesDir.resolve("lessons").deleteRecursively()
        client = FixtureClient()
        repository = QuizRepository(app, client, client)
        repository.profile = JSONObject().put("id", "11111111-1111-4111-8111-111111111111").put("name", "Professora Clara").put("permanent", true)
        vm = QuizViewModel(app, repository)
        compose.setContent { QuizEduTheme { Box(Modifier.sizeIn(maxWidth = 360.dp, maxHeight = 560.dp)) { QuizEduApp(vm) } } }
    }
    @Test fun liveSignalsAdvanceTheRoomAndOldSnapshotsCannotRollItBack() {
        val now = System.currentTimeMillis()
        val initial = JSONObject().put("code", "123456").put("title", "Aula ao vivo").put("teacher", "Clara").put("status", "slide").put("index", -1).put("total", 1).put("serverNow", now).put("version", "slide:1").put("revision", 1).put("isHost", false).put("players", JSONArray()).put("me", JSONObject().put("id", uid()).put("name", "Luana").put("avatar", "🦁"))
        client.transition(initial)
        compose.runOnIdle { vm.openRoom("123456", false) }
        compose.waitUntil(10000) { vm.room?.version == "slide:1" }
        val next = initial.copy().put("status", "question").put("index", 0).put("version", "question:2").put("revision", 2).put("serverNow", now + 1).put("startsAt", now + 3000).put("endsAt", now + 13000).put("question", JSONObject().put("text", "Qual alternativa?").put("options", JSONArray(listOf("A", "B"))).put("seconds", 10))
        client.transition(next)
        compose.waitUntil(1500) { vm.room?.version == "question:2" }
        assertEquals(now + 3000, vm.room!!.startsAt)
        val requests = client.roomRequests
        client.transition(initial.copy().put("serverNow", now + 99999))
        compose.waitUntil(1500) { client.roomRequests > requests }
        compose.runOnIdle { assertEquals("question:2", vm.room!!.version); assertEquals(2, vm.room!!.raw.optInt("revision")) }
    }
    @Test fun editorUndoesAndRedoesObjectsAndKeepsClipboardAcrossSlides() {
        compose.runOnIdle { vm.mode(true) }
        compose.waitUntil(10000) { !vm.busy }
        compose.runOnIdle {
            vm.newLesson(); val before = vm.slide!!.arr("elements").length()
            vm.addElement("shape"); assertEquals(before + 1, vm.slide!!.arr("elements").length())
            vm.undo(); assertEquals(before, vm.slide!!.arr("elements").length())
            vm.redo(); assertEquals(before + 1, vm.slide!!.arr("elements").length())
            val id = vm.slide!!.arr("elements").objects().last().str("id")
            vm.selectElement(id); vm.copyObjects(); vm.addSlide("blank"); vm.pasteObjects()
            assertEquals(1, vm.slide!!.arr("elements").length())
            assertNotEquals(id, vm.slide!!.arr("elements").objects().first().str("id"))
            vm.resizeElement(vm.selectedElement!!, 25f, 30f)
            assertEquals(265.0, vm.slide!!.arr("elements").objects().first().optDouble("w"), .01)
        }
    }
    @Test fun studentEntersWithNameAndAvatarWithoutAnAccount() {
        compose.onNodeWithText("Código de 6 números").performTextInput("123456")
        compose.onNodeWithText("Entrar na sala").performClick()
        compose.waitUntil(10000) { vm.room != null }
        compose.onNodeWithText("Você chegou!").assertIsDisplayed()
        compose.onNodeWithText("Como você quer aparecer?").performTextInput("Luana")
        compose.onNodeWithTag("student-join-action").assertIsDisplayed()
        compose.onNodeWithText("Como você quer aparecer?").performImeAction()
        compose.onNodeWithContentDescription("Avatar Bia").performClick()
        compose.onNodeWithText("Entrar e participar").assertIsDisplayed().performClick()
        compose.waitUntil(10000) { vm.room?.me != null }
        compose.onNodeWithText("Você está na sala!").performScrollTo().assertIsDisplayed()
        assertEquals("Luana", vm.room!!.me!!.str("name")); assertEquals("adventurer-02", vm.room!!.me!!.str("avatar"))
        assertEquals("123456", repository.preferences.getString("student_room", ""))
    }
    @Test fun illustratedAssetsDecodeLocallyAndLegacyChoicesStillResolve() = runBlocking {
        val loader = ImageLoader(app)
        try {
            assertEquals("adventurer-04", avatarOption("🦁").id)
            assertEquals(24, avatarOptions.size)
            for (avatar in avatarOptions) {
                val result = loader.execute(ImageRequest.Builder(app).data("file:///android_asset/avatars/${avatar.id}.svg")
                    .decoderFactory(SvgDecoder.Factory()).size(128).build())
                assertTrue("${avatar.id} must decode without network access", result is SuccessResult)
                val bitmap = (result as SuccessResult).drawable.toBitmap(128, 128)
                val pixels = IntArray(128 * 128); bitmap.getPixels(pixels, 0, 128, 0, 0, 128, 128)
                assertTrue("${avatar.id} must contain visible illustration paths", pixels.toSet().size > 20)
            }
        } finally { loader.shutdown() }
    }
    @Test fun avatarCarouselCanReachTheLastCharacterAndJoinStaysVisible() {
        compose.runOnIdle { vm.openRoom("123456", false) }
        compose.waitUntil(10000) { vm.room != null }
        compose.onNodeWithContentDescription("Avatar Luz").assertDoesNotExist()
        compose.onNodeWithTag("avatar-carousel").performTouchInput { swipeLeft() }
        compose.onNodeWithTag("avatar-carousel").performScrollToNode(hasContentDescription("Avatar Luz"))
        compose.onNodeWithContentDescription("Avatar Luz").assertIsDisplayed().performClick()
        compose.onNodeWithContentDescription("Avatar Luz").assertIsSelected()
        compose.onNodeWithTag("student-join-action").assertIsDisplayed()
    }
    @Test fun teacherStartAndNextStayVisibleBesideLongParticipantLists() {
        val players = JSONArray((1..100).map { JSONObject().put("id", "player-$it").put("name", "Aluno $it").put("avatar", avatarOptions[(it - 1) % 24].id).put("position", it).put("score", 0) })
        val initial = JSONObject().put("code", "123456").put("title", "Aula com a turma toda").put("teacher", "Clara").put("status", "lobby").put("index", -1).put("total", 1).put("isHost", true)
            .put("serverNow", System.currentTimeMillis()).put("version", "lobby:1").put("revision", 1).put("players", players)
        client.transition(initial)
        compose.runOnIdle { vm.openRoom("123456", true) }
        compose.waitUntil(10000) { vm.room?.version == "lobby:1" }
        compose.onNodeWithText("Iniciar quiz").assertIsDisplayed()
        compose.onNodeWithTag("room-content").performScrollToNode(hasText("Aluno 100"))
        compose.onNodeWithText("Iniciar quiz").assertIsDisplayed().assertIsEnabled()
        client.transition(initial.copy().put("presentation", JSONObject().put("index", 0).put("step", 0).put("total", 2)).put("version", "lobby:2").put("revision", 2))
        compose.waitUntil(10000) { vm.room?.version == "lobby:2" }
        compose.onNodeWithText("Iniciar apresentação").assertIsDisplayed()
        client.transition(initial.copy().put("status", "results").put("index", 0).put("version", "results:3").put("revision", 3))
        compose.waitUntil(10000) { vm.room?.version == "results:3" }
        compose.onNodeWithText("Próximo").assertIsDisplayed()
        compose.onNodeWithTag("room-content").performScrollToNode(hasText("Aluno 100"))
        compose.onNodeWithText("Próximo").assertIsDisplayed()
    }
    @Test fun teacherCreatesAndEditsARealNativeQuizSlide() {
        compose.onNodeWithText("Sou professor").performClick()
        compose.waitUntil(10000) { !vm.busy && vm.teacher }
        compose.onNodeWithText("Nova aula").performClick()
        compose.onNodeWithText("Salvar aula").assertIsDisplayed()
        compose.onNodeWithText("Adicionar slide").performScrollTo().performClick()
        compose.onNodeWithTag("slide-layouts").performScrollToNode(hasText("Quiz"))
        compose.onAllNodesWithText("Quiz", useUnmergedTree = true).onLast().performClick()
        compose.waitUntil(10000) { vm.slide?.str("kind") == "question" }
        compose.onNodeWithTag("presentation-editor").performScrollToNode(hasText("Enunciado"))
        compose.onNodeWithText("Enunciado").performScrollTo().performTextInput("Quanto é 2 + 2?")
        assertEquals("Quanto é 2 + 2?", vm.slide!!.getJSONObject("question").str("text"))
        assertEquals(-1, vm.slide!!.getJSONObject("question").optInt("correct"))
        val stored = QuizRepository(app).local(vm.editor!!.id)
        assertEquals("Quanto é 2 + 2?", stored!!.deck.arr("slides").getJSONObject(1).getJSONObject("question").str("text"))
        assertTrue(stored.dirty)
    }
    @Test fun androidKeystoreCredentialsSurviveRepositoryRecreation() {
        val token = randomToken()
        repository.secrets.set("test_session", token)
        assertEquals(token, QuizRepository(app).secrets.get("test_session"))
        repository.secrets.set("test_session", "")
        assertEquals("", QuizRepository(app).secrets.get("test_session"))
    }
    private class FixtureClient : QuizClient {
        private var participant: JSONObject? = null
        @Volatile private var liveRoom: JSONObject? = null
        @Volatile var roomRequests = 0
        private val changes = kotlinx.coroutines.channels.Channel<Unit>(kotlinx.coroutines.channels.Channel.CONFLATED)
        override val supportsRoomEvents: Boolean get() = true
        fun transition(state: JSONObject) { liveRoom = state.copy(); changes.trySend(Unit) }
        override suspend fun roomEvents(code: String, onSignal: (JSONObject) -> Unit) {
            while (kotlinx.coroutines.currentCoroutineContext()[kotlinx.coroutines.Job]?.isActive == true) {
                val state = liveRoom
                onSignal(JSONObject().put("version", state?.str("version") ?: "lobby:-1:0").put("status", state?.str("status") ?: "lobby").put("answeredCount", 0).put("serverNow", System.currentTimeMillis()))
                kotlinx.coroutines.withTimeoutOrNull(1000) { changes.receive() }
            }
        }
        override fun clear() {}
        override suspend fun image(bytes: ByteArray): JSONObject = throw IllegalStateException("No network uploads in UI tests.")
        override suspend fun request(path: String, data: JSONObject?, method: String): JSONObject {
            if (path == "/api/ping") return JSONObject().put("serverNow", System.currentTimeMillis())
            if (path == "/api/dashboard") return JSONObject().put("profile", JSONObject().put("id", "11111111-1111-4111-8111-111111111111").put("name", "Professora Clara").put("permanent", true)).put("quizzes", JSONArray()).put("rooms", JSONArray())
            if (path == "/api/presentations") return JSONObject().put("presentations", JSONArray())
            if (path.endsWith("/join")) { participant = JSONObject().put("id", uid()).put("name", data!!.str("name")).put("avatar", data.str("avatar")).put("score", 0).put("position", 1); return JSONObject().put("joined", true) }
            if (path.endsWith("/heartbeat")) return JSONObject().put("ok", true)
            if (path.startsWith("/api/rooms/")) { roomRequests++; return liveRoom?.copy() ?: JSONObject().put("code", "123456").put("title", "Aula de ciências").put("teacher", "Clara").put("status", "lobby").put("index", -1).put("total", 1).put("isHost", false).put("serverNow", System.currentTimeMillis()).put("version", "lobby:-1:0").put("players", if (participant == null) JSONArray() else JSONArray().put(participant)).put("me", participant ?: JSONObject.NULL) }
            throw IllegalStateException("Unexpected fixture route: $path")
        }
    }
}
