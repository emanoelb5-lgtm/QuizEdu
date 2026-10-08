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
    @Test fun guestCanJoinOrOpenCreationWithoutAnInlineRegistrationForm() {
        compose.runOnIdle { vm.signOut(); vm.mode(false) }
        compose.onNodeWithTag("home-sign-in").assertIsDisplayed()
        compose.onNodeWithTag("home-room-code").assertIsDisplayed()
        compose.onNodeWithText("Ler QR code").assertIsDisplayed()
        compose.onNodeWithTag("trial-name").assertDoesNotExist()
        compose.onNodeWithTag("home-create").performScrollTo().performClick()
        compose.onNodeWithTag("home-trial").performScrollTo().performClick()
        compose.onNodeWithTag("trial-name").assertIsDisplayed()
        compose.onNodeWithText("Cancelar").performClick()
        compose.onNodeWithTag("trial-name").assertDoesNotExist()
        compose.onNodeWithTag("home-sign-in").assertIsDisplayed()
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
        compose.onNodeWithTag("home-room-code").performTextInput("123456")
        compose.onNodeWithText("Entrar na sala").performClick()
        compose.waitUntil(10000) { vm.room != null }
        compose.onNodeWithText("Entrar na sala").assertIsDisplayed()
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
    @Test fun studentKeepsCurrentScoreAcrossQuestionResultAndPresentationWithoutClassroomLists() {
        val initial = studentQuestion()
        client.transition(initial)
        compose.runOnIdle { vm.openRoom("123456", false) }
        compose.waitUntil(10000) { vm.room?.version == "question:1" }
        compose.onNodeWithTag("student-current-score").assertTextEquals("1.500 pontos").assertIsDisplayed()
        compose.onNodeWithText("2º lugar").assertIsDisplayed()
        compose.onNodeWithText("Pergunta 1 de 3").assertIsDisplayed()
        compose.onNodeWithText("Quanto é 2 + 2?").assertIsDisplayed()
        compose.onNodeWithText("4").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("student-current-score").assertIsDisplayed()
        compose.onNodeWithTag("student-exit").assertIsDisplayed()
        compose.onNodeWithText("Aluno 100").assertDoesNotExist()
        compose.onNodeWithText("Classificação").assertDoesNotExist()

        val results = initial.copy().put("status", "results").put("version", "results:2").put("revision", 2).put("correct", 1).put("explanation", "Somar duas unidades a duas unidades resulta em quatro.")
        results.getJSONObject("me").put("score", 2200).put("answered", true).put("roundCorrect", true).put("roundPoints", 700)
        client.transition(results)
        compose.waitUntil(1500) { vm.room?.version == "results:2" }
        compose.onNodeWithTag("student-current-score").assertTextEquals("2.200 pontos").assertIsDisplayed()
        compose.onNodeWithText("Resposta certa!").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("+700 pontos nesta rodada").assertIsDisplayed()
        compose.onNodeWithText("Classificação").assertDoesNotExist()

        val slide = newSlide("blank").put("title", "Números e quantidades")
        slide.arr("elements").put(newElement("text", "azul").put("x", 40).put("y", 40).put("w", 1000).put("h", 180).put("doc", richText("Números e quantidades")))
        client.transition(results.copy().put("status", "slide").put("version", "slide:3").put("revision", 3).put("presentation", JSONObject().put("index", 1).put("step", 0).put("total", 4).put("slide", slide)))
        compose.waitUntil(1500) { vm.room?.version == "slide:3" }
        compose.onNodeWithText("Slide 2 de 4").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Números e quantidades").assertIsDisplayed()
        compose.onNodeWithTag("student-current-score").assertTextEquals("2.200 pontos").assertIsDisplayed()
        compose.onNodeWithText("Aluno 100").assertDoesNotExist()
        compose.onNodeWithTag("student-exit").assertIsDisplayed()
    }
    @Test fun studentExitRequiresConfirmationAndReturningPreservesIdentityAndScore() {
        client.transition(studentQuestion())
        compose.runOnIdle { vm.openRoom("123456", false) }
        compose.waitUntil(10000) { vm.room?.me != null }
        val participantId = vm.room!!.me!!.str("id")
        compose.onNodeWithTag("student-exit").performClick()
        compose.onNodeWithText("Sair desta sala?").assertIsDisplayed()
        compose.onNodeWithText("Continuar na sala").performClick()
        compose.onNodeWithTag("student-current-score").assertTextEquals("1.500 pontos").assertIsDisplayed()
        assertEquals(AppScreen.Room, vm.screen)
        compose.onNodeWithTag("student-exit").performClick()
        compose.onNodeWithText("Sair da sala").performClick()
        compose.waitUntil(10000) { vm.screen == AppScreen.Home }
        compose.onNodeWithTag("student-exit").assertDoesNotExist()
        compose.runOnIdle { vm.openRoom("123456", false) }
        compose.waitUntil(10000) { vm.room?.me != null }
        compose.onNodeWithTag("student-current-score").assertTextEquals("1.500 pontos").assertIsDisplayed()
        assertEquals(participantId, vm.room!!.me!!.str("id"))
    }
    private fun studentQuestion(): JSONObject {
        val now = System.currentTimeMillis()
        val me = JSONObject().put("id", "student-luana").put("name", "Luana").put("avatar", "adventurer-02").put("score", 1500).put("position", 2).put("answered", false).put("option", JSONObject.NULL)
        val players = JSONArray((1..100).map { JSONObject().put("id", "player-$it").put("name", "Aluno $it").put("avatar", "adventurer-01").put("position", it).put("score", 0) })
        return JSONObject().put("code", "123456").put("title", "Aula de matemática").put("teacher", "Clara").put("status", "question").put("index", 0).put("total", 3).put("isHost", false)
            .put("serverNow", now).put("version", "question:1").put("revision", 1).put("startsAt", now - 1000).put("endsAt", now + 60000).put("players", players).put("me", me)
            .put("question", JSONObject().put("text", "Quanto é 2 + 2?").put("options", JSONArray(listOf("3", "4"))).put("seconds", 60))
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
        compose.onNodeWithText("Minhas atividades").performClick()
        compose.waitUntil(10000) { !vm.busy && vm.teacher }
        compose.onNodeWithText("Nova apresentação").performClick()
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
    @Test fun teacherLoadsSharedExamplesAsIndependentEditableDraftsAndCanReuseCachedContent() {
        compose.runOnIdle { vm.mode(true) }
        compose.waitUntil(10000) { !vm.busy && vm.teacher }
        compose.onNodeWithTag("presentation-example").performScrollTo().performClick()
        compose.waitUntil(10000) { vm.screen == AppScreen.Editor && !vm.busy }
        val firstId = vm.editor!!.id
        val sourceQuestion = vm.editor!!.deck.arr("slides").getJSONObject(1).getJSONObject("question")
        assertEquals(7, vm.editor!!.deck.arr("slides").length())
        assertEquals("/examples/solo.jpg", vm.editor!!.deck.arr("slides").getJSONObject(0).getJSONObject("background").str("image"))
        assertEquals(6, vm.editor!!.deck.arr("slides").objects().count { it.str("kind") == "question" })
        compose.runOnIdle { vm.selectSlide(1); vm.changeSlide { it.getJSONObject("question").put("text", "Pergunta adaptada para a turma") }; vm.closeEditor() }
        compose.waitUntil(10000) { vm.screen == AppScreen.Home && !vm.busy }
        client.examplesUnavailable = true
        compose.onNodeWithTag("quiz-example").performScrollTo().performClick()
        compose.waitUntil(10000) { vm.screen == AppScreen.Editor && !vm.busy }
        assertNotEquals(firstId, vm.editor!!.id)
        assertEquals(6, vm.editor!!.deck.arr("slides").length())
        val questions = vm.editor!!.deck.arr("slides").objects().map { it.getJSONObject("question") }
        assertTrue(questions.any { it.str("kind") == "true_false" })
        assertTrue(questions.any { it.str("kind") == "image" && it.str("image") == "/examples/erosao.jpg" })
        assertTrue(questions.any { it.str("kind") == "scenario" })
        assertTrue(questions.any { it.arr("options").strings() == listOf("Sim", "Não") })
        assertTrue(questions.any { it.arr("optionImages").length() == 2 })
        assertNotEquals(sourceQuestion.str("id"), questions[0].str("id"))
        assertEquals("Pergunta adaptada para a turma", repository.local(firstId)!!.deck.arr("slides").getJSONObject(1).getJSONObject("question").str("text"))
        assertNotEquals("Pergunta adaptada para a turma", questions[0].str("text"))
        assertNull(validateLesson(vm.editor!!.deck))
    }
    @Test fun androidKeystoreCredentialsSurviveRepositoryRecreation() {
        val token = randomToken()
        repository.secrets.set("test_session", token)
        assertEquals(token, QuizRepository(app).secrets.get("test_session"))
        repository.secrets.set("test_session", "")
        assertEquals("", QuizRepository(app).secrets.get("test_session"))
    }
    private class FixtureClient : QuizClient {
        @Volatile var examplesUnavailable = false
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
            if (path == "/api/examples") {
                if (examplesUnavailable) throw java.io.IOException("Offline example fixture")
                val questions = JSONArray((0..5).map { index -> JSONObject().put("id", uid()).put("kind", listOf("multiple", "true_false", "image", "scenario", "multiple", "multiple")[index])
                    .put("text", "Pergunta de exemplo ${index + 1}").put("options", JSONArray(if (index == 1) listOf("Verdadeiro", "Falso") else if (index == 4) listOf("Sim", "Não") else listOf("Opção A", "Opção B"))).put("correct", 0).put("seconds", 30).put("explanation", "Explicação da resposta.")
                    .also { if (index == 2) it.put("image", "/examples/erosao.jpg"); if (index == 5) it.put("optionImages", JSONArray(listOf("/examples/palhada.jpg", "/examples/erosao.jpg"))) } })
                val cover = newSlide("cover", "campo").put("background", JSONObject().put("color", "#123b2c").put("image", "/examples/solo.jpg"))
                val deck = newDeck().put("title", "Solo vivo, turma em ação").put("slides", JSONArray().put(cover))
                questions.objects().forEach { deck.arr("slides").put(newSlide("question", "campo").put("question", it.copy())) }
                return JSONObject().put("presentation", deck).put("quiz", JSONObject().put("title", deck.str("title")).put("questions", questions))
            }
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
