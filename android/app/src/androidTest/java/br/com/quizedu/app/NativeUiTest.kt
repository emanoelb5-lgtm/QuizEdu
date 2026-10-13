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
        vm = QuizViewModel(app, repository) { null }
        compose.setContent { QuizEduTheme { Box(Modifier.sizeIn(maxWidth = 360.dp, maxHeight = 560.dp)) { QuizEduApp(vm) } } }
    }
    @Test fun guestCanJoinOrOpenCreationWithoutAnInlineRegistrationForm() {
        compose.runOnIdle { vm.signOut(); vm.mode(false) }
        compose.onNodeWithTag("home-sign-in").assertIsDisplayed()
        compose.onNodeWithTag("home-room-code").assertIsDisplayed()
        compose.onNodeWithText("Ler QR code").assertIsDisplayed()
        compose.onNodeWithTag("trial-name").assertDoesNotExist()
        compose.onNodeWithTag("student-home-content").performScrollToNode(hasTestTag("home-create"))
        compose.onNodeWithTag("home-create").assertIsDisplayed().performClick()
        compose.onNodeWithTag("teacher-home-content").performScrollToNode(hasTestTag("home-trial"))
        compose.onNodeWithTag("home-trial").assertIsDisplayed().performClick()
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
        compose.onNodeWithTag("join-content").performScrollToNode(hasTestTag("student-name-input"))
        compose.onNodeWithTag("student-name-input").assertIsDisplayed().performTextInput("Luana")
        compose.onNodeWithTag("student-join-action").assertIsDisplayed()
        compose.onNodeWithTag("student-name-input").performImeAction()
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
    @Test fun studentKeepsCurrentScoreAndPinnedRankingAcrossQuestionResultAndPresentation() {
        val initial = studentQuestion()
        client.transition(initial)
        compose.runOnIdle { vm.openRoom("123456", false) }
        compose.waitUntil(10000) { vm.room?.version == "question:1" }
        compose.onNodeWithTag("student-current-score").assertTextEquals("1.500 pontos").assertIsDisplayed()
        compose.onNodeWithTag("student-ranking").assertIsDisplayed()
        compose.onNodeWithText("2º lugar").assertIsDisplayed()
        compose.onNodeWithText("Pergunta 1 de 3").assertIsDisplayed()
        compose.onNodeWithText("Quanto é 2 + 2?").assertIsDisplayed()
        compose.onNodeWithText("4").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("student-current-score").assertIsDisplayed()
        compose.onNodeWithTag("student-exit").assertIsDisplayed()
        compose.onNodeWithText("Aluno 100").assertDoesNotExist()
        compose.onNodeWithTag("student-ranking").assertIsDisplayed()

        val results = initial.copy().put("status", "results").put("version", "results:2").put("revision", 2).put("correct", 1).put("explanation", "Somar duas unidades a duas unidades resulta em quatro.")
        results.getJSONObject("me").put("score", 2200).put("answered", true).put("roundCorrect", true).put("roundPoints", 700)
        client.transition(results)
        compose.waitUntil(1500) { vm.room?.version == "results:2" }
        compose.onNodeWithTag("student-current-score").assertTextEquals("2.200 pontos").assertIsDisplayed()
        compose.onNodeWithText("Resposta certa!").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("+700 pontos nesta rodada").assertIsDisplayed()
        compose.onNodeWithTag("student-ranking").assertIsDisplayed()

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
    @Test fun catalogCopiesAnIndependentLessonAndItsCloudRemainsEditable() {
        compose.onNodeWithTag("student-home-content").performScrollToNode(hasTestTag("ready-lessons"))
        compose.onNodeWithTag("ready-lessons").assertIsDisplayed().performClick()
        compose.waitUntil(10000) { vm.readyCatalog != null && !vm.busy }
        compose.onNodeWithTag("lesson-search").performTextInput("opiniao")
        compose.onNodeWithTag("lesson-catalog").performScrollToNode(hasTestTag("ready-artigo-opiniao-9-ano-aula-1"))
        compose.onNodeWithTag("ready-artigo-opiniao-9-ano-aula-1").performClick()
        compose.waitUntil(10000) { vm.readyDetail != null && !vm.busy }
        compose.onNodeWithTag("use-ready-lesson").assertIsDisplayed().performClick()
        compose.waitUntil(10000) { vm.screen == AppScreen.Editor && !vm.busy }
        assertEquals(1, vm.editor!!.revision)
        assertNotEquals(client.readySource.str("id"), vm.editor!!.id)
        assertEquals("Artigo de opinião", vm.editor!!.deck.str("title"))
        val id = vm.editor!!.id
        compose.runOnIdle { vm.selectSlide(1) }
        compose.onNodeWithTag("presentation-editor").performScrollToNode(hasTestTag("cloud-prompt"))
        compose.onNodeWithTag("cloud-prompt").performTextReplacement("Que palavras ajudam a argumentar?")
        assertEquals("Que palavras ajudam a argumentar?", repository.local(id)!!.deck.arr("slides").getJSONObject(1).getJSONObject("wordCloud").str("prompt"))
        assertNotEquals("Que palavras ajudam a argumentar?", client.readySource.arr("slides").getJSONObject(1).getJSONObject("wordCloud").str("prompt"))
    }
    @Test fun cloudRetriesLostAcknowledgementsWithoutDoublePointsAndWarnsAboutDuplicateWords() {
        val initial = studentQuestion().put("status", "wordcloud").put("version", "cloud:1").put("revision", 1)
            .put("presentation", JSONObject().put("index", 1).put("total", 2).put("slide", newSlide("wordcloud")))
            .put("wordCloud", JSONObject().put("slideId", uid()).put("prompt", "Uma palavra para argumentar").put("accepting", true).put("pointsPerWord", 100).put("words", JSONArray()).put("myWords", JSONArray()))
        initial.getJSONObject("me").put("score", 0)
        client.transition(initial); client.loseFirstWordAck = true
        compose.runOnIdle { vm.openRoom("123456", false) }
        compose.waitUntil(10000) { vm.room?.status == "wordcloud" }
        compose.onNodeWithTag("student-ranking").assertIsDisplayed()
        compose.runOnIdle { vm.sendCloudWord("Tese") }
        compose.waitUntil(10000) { !vm.busy && vm.cloudPending != null && vm.room?.me?.optInt("score") == 100 }
        val writeId = vm.cloudPending!!.str("writeId")
        assertEquals(writeId, JSONObject(repository.preferences.getString("cloud_pending", "{}")!!).str("writeId"))
        compose.onNodeWithTag("cloud-send").performScrollTo().assertIsDisplayed().assertTextContains("Tentar novamente").performClick()
        compose.waitUntil(10000) { !vm.busy && vm.cloudPending == null }
        assertEquals(100, vm.room!!.me!!.optInt("score")); assertEquals(2, client.cloudRequests)
        compose.onNodeWithTag("student-ranking").assertIsDisplayed()
        compose.runOnIdle { vm.sendCloudWord("TESE") }
        compose.waitUntil(10000) { !vm.busy && vm.cloudNotice?.contains("já está na nuvem") == true }
        assertEquals(2, client.cloudRequests)
        compose.runOnIdle { vm.sendCloudWord("Opinião") }
        compose.waitUntil(10000) { !vm.busy && vm.room?.me?.optInt("score") == 200 }
        assertEquals(2, vm.room!!.wordCloud!!.arr("myWords").length())
        compose.onNodeWithTag("student-current-score").assertTextEquals("200 pontos").assertIsDisplayed()
        val paused = vm.room!!.raw.copy().put("status", "slide").put("version", "cloud:4").put("revision", 4)
        paused.getJSONObject("wordCloud").put("accepting", false)
        client.transition(paused)
        compose.waitUntil(10000) { vm.room?.version == "cloud:4" }
        compose.onNodeWithTag("cloud-send").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag("student-ranking").assertIsDisplayed()
    }
    @Test fun teacherFullscreenShowsAndThenRemovesTheBriefRanking() {
        val state = studentQuestion().put("isHost", true).put("status", "results").put("version", "results:8").put("revision", 8)
            .put("presentation", JSONObject().put("index", 1).put("step", 0).put("total", 3).put("slide", newSlide("blank")))
        client.transition(state)
        compose.runOnIdle { vm.openRoom("123456", true) }
        compose.waitUntil(10000) { vm.room?.version == "results:8" }
        compose.runOnIdle { vm.showFullscreen(true) }
        compose.onNodeWithTag("fullscreen-presentation").assertIsDisplayed()
        compose.onNodeWithTag("ranking-spotlight").assertIsDisplayed()
        compose.mainClock.advanceTimeBy(6500)
        compose.waitForIdle()
        compose.onNodeWithTag("ranking-spotlight").assertDoesNotExist()
        compose.runOnIdle { vm.showFullscreen(false) }
        compose.onNodeWithTag("teacher-controls").assertIsDisplayed()
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
        compose.onNodeWithTag("teacher-home-content").performScrollToNode(hasTestTag("presentation-example"))
        compose.onNodeWithTag("presentation-example").assertIsDisplayed().performClick()
        compose.waitUntil(10000) { vm.screen == AppScreen.Editor && !vm.busy }
        val firstId = vm.editor!!.id
        val sourceQuestion = vm.editor!!.deck.arr("slides").getJSONObject(1).getJSONObject("question")
        assertEquals(7, vm.editor!!.deck.arr("slides").length())
        assertEquals("/examples/solo.jpg", vm.editor!!.deck.arr("slides").getJSONObject(0).getJSONObject("background").str("image"))
        assertEquals(6, vm.editor!!.deck.arr("slides").objects().count { it.str("kind") == "question" })
        compose.runOnIdle { vm.selectSlide(1); vm.changeSlide { it.getJSONObject("question").put("text", "Pergunta adaptada para a turma") }; vm.closeEditor() }
        compose.waitUntil(10000) { vm.screen == AppScreen.Home && !vm.busy }
        client.examplesUnavailable = true
        compose.onNodeWithTag("teacher-home-content").performScrollToNode(hasTestTag("quiz-example"))
        compose.onNodeWithTag("quiz-example").assertIsDisplayed().performClick()
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
        @Volatile var cloudRequests = 0
        @Volatile var loseFirstWordAck = false
        private val wordWrites = mutableSetOf<String>()
        val readySource = newDeck().put("title", "Artigo de opinião").put("slides", JSONArray().put(newSlide("cover")).put(newSlide("wordcloud")))
        private fun readyMetadata() = JSONObject().put("id", "artigo-opiniao-9-ano-aula-1").put("title", "Artigo de opinião").put("subject", "Português").put("subjectId", "portugues").put("grade", "9").put("gradeLabel", "9º ano").put("unit", "Aula 1").put("description", "Tese e argumentos").put("slideCount", 2).put("questionCount", 0).put("cloudCount", 1).put("objectives", JSONArray(listOf("Reconhecer opiniões"))).put("tags", JSONArray(listOf("tese")))
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
            if (path == "/api/lessons") return JSONObject().put("lessons", JSONArray().put(readyMetadata())).put("subjects", JSONArray().put(JSONObject().put("id", "portugues").put("name", "Português"))).put("grades", JSONArray().put(JSONObject().put("id", "9").put("name", "9º ano")))
            if (path == "/api/lessons/artigo-opiniao-9-ano-aula-1") return JSONObject().put("lesson", readyMetadata()).put("presentation", readySource.copy())
            if (path == "/api/presentations" && data != null) return JSONObject().put("presentation", JSONObject().put("deck", data.getJSONObject("deck").copy()).put("revision", 1).put("writeId", data.str("writeId")))
            if (path.endsWith("/word")) {
                cloudRequests++
                val payload = data!!
                val added = wordWrites.add(payload.str("writeId"))
                if (added) {
                    val next = liveRoom!!.copy(); val cloud = next.getJSONObject("wordCloud")
                    val entry = JSONObject().put("id", payload.str("writeId")).put("word", payload.str("word"))
                    cloud.arr("words").put(entry); cloud.arr("myWords").put(entry.copy())
                    val me = next.getJSONObject("me"); me.put("score", me.optInt("score") + 100)
                    val player = next.arr("players").objects().find { it.str("id") == me.str("id") }
                    if (player == null) next.arr("players").put(me.copy()) else player.put("score", me.optInt("score"))
                    next.put("revision", next.optInt("revision") + 1).put("version", "cloud:${next.optInt("revision")}")
                    transition(next)
                }
                if (loseFirstWordAck) { loseFirstWordAck = false; throw java.io.IOException("Lost acknowledgement") }
                return JSONObject().put("accepted", true).put("added", added).put("pointsAwarded", if (added) 100 else 0)
            }
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
