package br.com.quizedu.app

import android.app.Application
import android.content.Context
import androidx.compose.ui.test.*
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
    @Before fun setup() {
        app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application
        app.getSharedPreferences("quizedu_preferences", Context.MODE_PRIVATE).edit().clear().commit()
        app.filesDir.resolve("lessons").deleteRecursively()
        val client = FixtureClient()
        repository = QuizRepository(app, client, client)
        repository.profile = JSONObject().put("id", "11111111-1111-4111-8111-111111111111").put("name", "Professora Clara").put("permanent", true)
        vm = QuizViewModel(app, repository)
        compose.setContent { QuizEduTheme { QuizEduApp(vm) } }
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
        compose.onNodeWithText("🦁").performClick()
        compose.onNodeWithText("Entrar e participar").performScrollTo().performClick()
        compose.waitUntil(10000) { vm.room?.me != null }
        compose.onNodeWithText("Você está na sala!").performScrollTo().assertIsDisplayed()
        assertEquals("Luana", vm.room!!.me!!.str("name")); assertEquals("🦁", vm.room!!.me!!.str("avatar"))
        assertEquals("123456", repository.preferences.getString("student_room", ""))
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
        override fun clear() {}
        override suspend fun image(bytes: ByteArray): JSONObject = throw IllegalStateException("No network uploads in UI tests.")
        override suspend fun request(path: String, data: JSONObject?, method: String): JSONObject {
            if (path == "/api/dashboard") return JSONObject().put("profile", JSONObject().put("id", "11111111-1111-4111-8111-111111111111").put("name", "Professora Clara").put("permanent", true)).put("quizzes", JSONArray()).put("rooms", JSONArray())
            if (path == "/api/presentations") return JSONObject().put("presentations", JSONArray())
            if (path.endsWith("/join")) { participant = JSONObject().put("id", uid()).put("name", data!!.str("name")).put("avatar", data.str("avatar")).put("score", 0).put("position", 1); return JSONObject().put("joined", true) }
            if (path.endsWith("/heartbeat")) return JSONObject().put("ok", true)
            if (path.startsWith("/api/rooms/")) return JSONObject().put("code", "123456").put("title", "Aula de ciências").put("teacher", "Clara").put("status", "lobby").put("index", -1).put("total", 1).put("isHost", false).put("serverNow", System.currentTimeMillis()).put("version", "lobby:-1:0").put("players", if (participant == null) JSONArray() else JSONArray().put(participant)).put("me", participant ?: JSONObject.NULL)
            throw IllegalStateException("Unexpected fixture route: $path")
        }
    }
}
