package br.com.quizedu.app

import android.app.Application
import android.content.Context
import android.graphics.Bitmap
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Before
import org.junit.Rule
import org.junit.Test

// Real Compose UI rendered by an Android emulator with fictional classroom data.
class StoreScreenshotsTest {
    @get:Rule val compose = createComposeRule()
    private lateinit var vm: QuizViewModel
    private lateinit var client: ScreenshotClient
    @Before fun setup() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as Application
        app.getSharedPreferences("quizedu_preferences", Context.MODE_PRIVATE).edit().clear().commit()
        client = ScreenshotClient()
        val repository = QuizRepository(app, client, client)
        vm = QuizViewModel(app, repository) { null }
        compose.setContent { QuizEduTheme { QuizEduApp(vm) } }
    }
    private fun save(name: String) {
        compose.waitForIdle()
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val folder = instrumentation.targetContext.getExternalFilesDir(null)!!.resolve("store-screenshots").apply { mkdirs() }
        val bitmap = instrumentation.uiAutomation.takeScreenshot()
        folder.resolve(name).outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
    }
    @Test fun captureStudentEntry() {
        compose.onNodeWithTag("home-room-code").assertIsDisplayed()
        save("01-entrar-na-aula.png")
    }
    @Test fun captureNativeEditor() {
        compose.runOnIdle { vm.acceptTerms(true); vm.temporary("Professora Clara") }
        compose.waitUntil(10000) { !vm.busy && vm.profile != null }
        compose.runOnIdle {
            vm.newLesson()
            vm.changeDeck { it.put("title", "Artigo de opinião") }
            vm.changeSlide { s -> s.put("title", "Minha voz, meus argumentos") }
        }
        compose.waitUntil(10000) { vm.screen == AppScreen.Editor }
        compose.waitForIdle(); save("02-editor-de-apresentacoes.png")
    }
    private fun baseState(status: String): JSONObject {
        val now = System.currentTimeMillis()
        val players = JSONArray(listOf("Lia", "Ravi", "Bia", "Caio", "Nina").mapIndexed { i, name -> JSONObject().put("id", "demo-$i").put("name", name).put("avatar", "adventurer-${(i+1).toString().padStart(2,'0')}").put("score", 500-i*100).put("position", i+1).put("correctCount", 1) })
        return JSONObject().put("code", "123456").put("title", "Artigo de opinião").put("teacher", "Professora Clara").put("status", status).put("index", 1).put("total", 4).put("serverNow", now).put("revision", 4).put("version", "$status:4").put("isHost", false).put("players", players).put("me", players.getJSONObject(1)).put("untimed", true).put("gradingTotal", 2)
    }
    @Test fun captureWordCloud() {
        val words = JSONArray(listOf("respeito", "diálogo", "argumento", "opinião", "escuta", "evidência").mapIndexed { i,w -> JSONObject().put("id", "word-$i").put("word", w) })
        client.state = baseState("wordcloud").put("wordCloud", JSONObject().put("slideId", "demo-cloud").put("prompt", "O que fortalece um bom argumento?").put("accepting", true).put("words", words).put("myWords", JSONArray()).put("pointsPerWord", 100))
        compose.runOnIdle { vm.acceptTerms(true); vm.openRoom("123456", false) }
        compose.waitUntil(10000) { vm.room?.wordCloud != null }
        compose.onNodeWithTag("word-cloud").assertIsDisplayed(); save("03-nuvem-de-palavras.png")
    }
    @Test fun capturePollResults() {
        client.state = baseState("results").put("question", JSONObject().put("kind", "poll").put("text", "Você prefere ler no papel ou na tela?").put("options", JSONArray(listOf("No papel", "Na tela"))).put("seconds", 30).put("allowMultiple", false)).put("poll", JSONObject().put("allowMultiple", false).put("revealed", true).put("respondents", 5).put("myChoices", JSONArray(listOf(0))).put("counts", JSONArray(listOf(3,2))).put("percentages", JSONArray(listOf(60,40))))
        compose.runOnIdle { vm.openRoom("123456", false) }
        compose.waitUntil(10000) { vm.room?.poll != null }
        compose.waitForIdle(); save("04-enquete-resultados.png")
    }
    private class ScreenshotClient : QuizClient {
        @Volatile var state: JSONObject? = null
        @Volatile var profile: JSONObject? = null
        override fun clear() {}
        override suspend fun image(bytes: ByteArray): JSONObject = error("No uploads in screenshots")
        override suspend fun request(path: String, data: JSONObject?, method: String): JSONObject = when {
            path.startsWith("/api/rooms/") -> state!!.copy()
            path == "/api/profile" -> {
                profile = JSONObject().put("id", "11111111-1111-4111-8111-111111111111").put("name", data!!.str("name")).put("permanent", false)
                JSONObject().put("profile", profile)
            }
            path == "/api/dashboard" -> JSONObject().put("profile", profile ?: JSONObject.NULL).put("quizzes", JSONArray()).put("rooms", JSONArray())
            path == "/api/presentations/active" -> JSONObject().put("ownerId", "").put("presentations", JSONArray())
            path == "/api/presentations" -> JSONObject().put("presentations", JSONArray())
            else -> JSONObject().put("serverNow", System.currentTimeMillis())
        }
    }
}
