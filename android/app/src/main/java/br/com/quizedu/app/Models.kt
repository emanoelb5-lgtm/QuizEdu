package br.com.quizedu.app

import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID
import kotlin.math.max

const val SLIDE_W = 1000f
const val SLIDE_H = 562.5f
val durations = listOf(10, 15, 20, 30, 45, 60, 90, 120)
fun uid(): String = UUID.randomUUID().toString()
fun JSONObject.copy(): JSONObject = JSONObject(toString())
fun JSONObject.str(key: String, fallback: String = ""): String = if (isNull(key)) fallback else optString(key, fallback)
fun JSONObject.arr(key: String): JSONArray = optJSONArray(key) ?: JSONArray()
fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
fun JSONArray.strings(): List<String> = (0 until length()).map { optString(it, "") }
fun jsonArray(items: List<*>): JSONArray = JSONArray(items)
fun randomToken(): String = ByteArray(32).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it.toInt() and 255) }
fun sha256(value: String): String = MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it.toInt() and 255) }

fun roomCode(value: String, site: String = BuildConfig.SITE_URL): String? {
    val input = value.trim()
    if (input.matches(Regex("[0-9]{6}"))) return input
    return try {
        val uri = URI(input)
        val expected = URI(site)
        if (uri.scheme != "https" || uri.host != expected.host || uri.userInfo != null || uri.port != -1) return null
        Regex("^/participar/([0-9]{6})/?$").matchEntire(uri.path)?.groupValues?.get(1)
    } catch (_: Exception) { null }
}
fun mediaUrl(path: String): String? = if (path.matches(Regex("/api/media/[a-f0-9-]{36}")) || path.matches(Regex("/examples/(solo|palhada|erosao|minhoca|cultivo|plantio)\\.jpg"))) BuildConfig.SITE_URL + path else null
fun videoId(value: String): String? {
    if (value.matches(Regex("[\\w-]{11}"))) return value
    return try {
        val uri = URI(value.trim())
        if (uri.scheme !in listOf("https", "http") || uri.userInfo != null) return null
        val host = uri.host?.removePrefix("www.") ?: return null
        val id = when (host) {
            "youtu.be" -> uri.path.removePrefix("/")
            "youtube.com", "m.youtube.com", "youtube-nocookie.com" ->
                Regex("(?:^|&)v=([\\w-]{11})(?:&|$)").find(uri.rawQuery ?: "")?.groupValues?.get(1)
                    ?: Regex("^/(?:embed|shorts)/([\\w-]{11})$").find(uri.path)?.groupValues?.get(1)
            else -> null
        }
        id?.takeIf { it.matches(Regex("[\\w-]{11}")) }
    } catch (_: Exception) { null }
}
fun plainText(node: JSONObject?): String {
    if (node == null) return ""
    if (node.str("type") == "text") return node.str("text")
    if (node.str("type") == "hardBreak") return "\n"
    val separator = if (node.str("type") in listOf("doc", "bulletList", "orderedList")) "\n" else ""
    return node.arr("content").objects().joinToString(separator) { plainText(it) }
}
fun richText(text: String, bold: Boolean = false, italic: Boolean = false): JSONObject = JSONObject().put("type", "doc").put("content", jsonArray(text.split("\n").map { line ->
    val node = JSONObject().put("type", "text").put("text", line)
    val marks = mutableListOf<JSONObject>()
    if (bold) marks.add(JSONObject().put("type", "bold"))
    if (italic) marks.add(JSONObject().put("type", "italic"))
    if (marks.isNotEmpty()) node.put("marks", jsonArray(marks))
    JSONObject().put("type", "paragraph").put("content", if (line.isEmpty()) JSONArray() else JSONArray().put(node))
}))

data class DeckTheme(val id: String, val name: String, val background: String, val text: String, val accent: String, val secondary: String, val font: String = "Arial")
val deckThemes = listOf(
    DeckTheme("prativerso", "Prativerso", "#ffffff", "#23213d", "#6546d7", "#f0edff"),
    DeckTheme("azul", "Azul clássico", "#ffffff", "#15203d", "#3155ed", "#eaf0ff"),
    DeckTheme("noite", "Noite", "#111c35", "#ffffff", "#d2fb66", "#20304b"),
    DeckTheme("campo", "Campo", "#f6fff8", "#123b2c", "#168653", "#dcf5e5", "Trebuchet MS"),
    DeckTheme("oceano", "Oceano", "#eefbff", "#09354b", "#087eaa", "#cfeef8"),
    DeckTheme("sol", "Sol", "#fff9ec", "#442c15", "#d77b08", "#ffebc6", "Georgia"),
    DeckTheme("uva", "Uva", "#fbf7ff", "#33204f", "#863de5", "#efe0ff"),
    DeckTheme("papel", "Papel", "#ffffff", "#242424", "#1b1b1b", "#eeeeee", "Georgia"),
    DeckTheme("cereja", "Cereja", "#fff6f7", "#4a1925", "#d93456", "#ffe0e7")
)
fun themeFor(id: String): DeckTheme = deckThemes.find { it.id == id } ?: deckThemes.first()

fun newElement(type: String, theme: String): JSONObject {
    val t = themeFor(theme)
    val e = JSONObject().put("id", uid()).put("type", type).put("x", 80).put("y", 100).put("w", 480).put("h", 170)
        .put("rotation", 0).put("opacity", 100).put("locked", false).put("hidden", false).put("build", 0)
    when (type) {
        "text" -> e.put("doc", richText("Digite seu texto")).put("font", t.font).put("fontSize", 30).put("color", t.text).put("align", "left")
        "image" -> e.put("x", 160).put("y", 90).put("w", 600).put("h", 360).put("src", "").put("alt", "").put("fit", "cover").put("positionX", 50).put("positionY", 50).put("radius", 12)
        "shape" -> e.put("w", 240).put("h", 150).put("shape", "rect").put("fill", t.secondary).put("stroke", t.accent).put("strokeWidth", 2).put("radius", 12)
        "table" -> e.put("x", 80).put("y", 160).put("w", 840).put("h", 290).put("cells", JSONArray().put(JSONArray(listOf("Item", "Características", "Exemplo"))).put(JSONArray(listOf("Item 1", "Descrição", "Exemplo 1"))).put(JSONArray(listOf("Item 2", "Descrição", "Exemplo 2"))))
            .put("header", true).put("fontSize", 24).put("color", t.text).put("fill", t.accent)
        "chart" -> e.put("x", 110).put("y", 155).put("w", 780).put("h", 300).put("chart", "bar").put("labels", JSONArray(listOf("Grupo A", "Grupo B", "Grupo C", "Grupo D"))).put("values", JSONArray(listOf(30, 55, 75, 45))).put("fill", t.accent).put("color", t.text).put("fontSize", 20)
        "video" -> e.put("x", 140).put("y", 105).put("w", 720).put("h", 405).put("videoId", "").put("videoStart", 0)
    }
    return e
}
private fun textElement(text: String, x: Int, y: Int, w: Int, h: Int, size: Int, theme: String): JSONObject = newElement("text", theme).put("x", x).put("y", y).put("w", w).put("h", h).put("fontSize", size).put("doc", richText(text))
fun newSlide(layout: String = "title", theme: String = "prativerso"): JSONObject {
    val t = themeFor(theme)
    val slide = JSONObject().put("id", uid()).put("kind", "content").put("title", "Novo slide").put("notes", "")
        .put("background", JSONObject().put("color", t.background)).put("transition", "fade").put("elements", JSONArray())
    val elements = mutableListOf<JSONObject>()
    when (layout) {
        "question", "true_false" -> {
            slide.put("kind", "question").put("title", "Pergunta para a turma")
            slide.put("question", JSONObject().put("id", uid()).put("kind", if (layout == "true_false") "true_false" else "multiple")
                .put("text", "").put("options", JSONArray(if (layout == "true_false") listOf("Verdadeiro", "Falso") else listOf("", "", "", ""))).put("correct", -1).put("seconds", 30).put("explanation", ""))
        }
        "blank" -> Unit
        "cover", "section", "closing" -> {
            elements.add(newElement("shape", theme).put("x", 0).put("y", 0).put("w", 18).put("h", 562.5).put("fill", t.accent).put("strokeWidth", 0).put("radius", 0))
            elements.add(textElement(if (layout == "closing") "O que aprendemos hoje?" else "Título da sua aula", 80, 145, 830, 170, 62, theme))
            elements.add(textElement("Adicione um subtítulo ou o objetivo da aula.", 85, 345, 800, 100, 28, theme))
        }
        "columns", "comparison" -> {
            elements.add(textElement("Título do slide", 65, 45, 865, 90, 44, theme))
            listOf(65, 515).forEachIndexed { i, x ->
                elements.add(newElement("shape", theme).put("x", x).put("y", 165).put("w", 420).put("h", 315).put("fill", t.secondary).put("strokeWidth", 0))
                elements.add(textElement(if (i == 0) "Primeira ideia" else "Segunda ideia", x + 25, 190, 360, 55, 30, theme).put("color", t.accent))
                elements.add(textElement("Explique sua ideia.\n\nUse exemplos que a turma conhece.", x + 25, 265, 360, 180, 26, theme))
            }
        }
        "image" -> { elements.add(textElement("Título do slide", 65, 45, 865, 90, 44, theme)); elements.add(textElement("Explique o que a turma deve observar.", 65, 180, 380, 270, 31, theme)); elements.add(newElement("image", theme).put("x", 495).put("y", 160).put("w", 440).put("h", 325)) }
        "table", "chart" -> { elements.add(textElement("Título do slide", 65, 45, 865, 90, 44, theme)); elements.add(newElement(layout, theme)) }
        "quote" -> { elements.add(textElement("Uma frase para pensar e aprender juntos.", 95, 140, 810, 235, 49, theme).put("color", t.accent)); elements.add(textElement("Fonte ou autoria", 100, 400, 800, 65, 24, theme)) }
        else -> { elements.add(textElement("Título do slide", 65, 45, 865, 90, 44, theme)); elements.add(textElement("Apresente a ideia principal.\n\nAcrescente um exemplo.\n\nConvide a turma para conversar.", 70, 175, 850, 310, 34, theme)) }
    }
    return slide.put("elements", jsonArray(elements))
}
fun newDeck(): JSONObject = JSONObject().put("id", uid()).put("title", "Minha aula interativa").put("subject", "").put("topic", "").put("theme", "prativerso")
    .put("slides", JSONArray().put(newSlide("cover"))).put("mode", "speed").put("untimed", false).put("showSlideNumbers", true)
fun duplicateSlide(slide: JSONObject): JSONObject {
    val copy = slide.copy().put("id", uid())
    copy.optJSONObject("question")?.put("id", uid())
    val groups = mutableMapOf<String, String>()
    copy.arr("elements").objects().forEach { e -> e.put("id", uid()); if (e.has("group")) e.put("group", groups.getOrPut(e.str("group")) { uid() }) }
    return copy
}
fun duplicateDeck(deck: JSONObject): JSONObject = deck.copy().put("id", uid()).put("title", (deck.str("title").take(88) + " (cópia)"))
    .put("slides", jsonArray(deck.arr("slides").objects().map(::duplicateSlide)))
fun boundedGeometry(e: JSONObject, x: Float, y: Float, w: Float = e.optDouble("w").toFloat(), h: Float = e.optDouble("h").toFloat()): JSONObject {
    val width = w.takeIf { it.isFinite() }?.coerceIn(12f, SLIDE_W) ?: 480f
    val height = h.takeIf { it.isFinite() }?.coerceIn(8f, SLIDE_H) ?: 170f
    return e.copy().put("w", width).put("h", height).put("x", (if (x.isFinite()) x else 0f).coerceIn(0f, SLIDE_W - width))
        .put("y", (if (y.isFinite()) y else 0f).coerceIn(0f, SLIDE_H - height))
}
fun validateLesson(deck: JSONObject): String? {
    if (deck.str("title").isBlank()) return "Dê um título à aula."
    if (deck.arr("slides").length() !in 1..150) return "Use de 1 a 150 slides."
    val questions = deck.arr("slides").objects().filter { it.str("kind") == "question" }
    if (questions.size > 50) return "Use até 50 perguntas por aula."
    questions.forEach { s ->
        val q = s.optJSONObject("question") ?: return "Preencha a pergunta."
        val options = q.arr("options").strings()
        if (q.str("text").isBlank() || options.any { it.isBlank() }) return "Preencha o enunciado e as alternativas de todas as perguntas."
        if (q.optInt("correct", -1) !in options.indices) return "Marque a resposta correta de todas as perguntas."
        if (options.map { it.trim().lowercase().replace(Regex("\\s+"), " ") }.distinct().size != options.size) return "Use alternativas diferentes."
        if (q.str("kind") == "image" && q.str("image").isBlank()) return "Adicione a imagem da pergunta."
    }
    return null
}

data class LessonDraft(val deck: JSONObject, val revision: Int, val dirty: Boolean = false, val pending: JSONObject? = null) {
    val id: String get() = deck.str("id")
    fun toJson(): JSONObject = JSONObject().put("deck", deck).put("revision", revision).put("dirty", dirty).put("pending", pending ?: JSONObject.NULL)
    companion object { fun fromJson(j: JSONObject): LessonDraft = LessonDraft(j.getJSONObject("deck"), j.optInt("revision"), j.optBoolean("dirty"), j.optJSONObject("pending")) }
}
data class RoomSnapshot(val raw: JSONObject) {
    val code get() = raw.str("code")
    val status get() = raw.str("status")
    val title get() = raw.str("title")
    val index get() = raw.optInt("index", -1)
    val total get() = raw.optInt("total")
    val version get() = raw.str("version")
    val isHost get() = raw.optBoolean("isHost")
    val me get() = raw.optJSONObject("me")
    val question get() = raw.optJSONObject("question")
    val presentation get() = raw.optJSONObject("presentation")
    val players get() = raw.arr("players").objects()
    val serverNow get() = raw.optLong("serverNow")
    val startsAt get() = raw.optLong("startsAt")
    val endsAt get() = raw.optLong("endsAt")
    val correct get() = if (raw.isNull("correct")) null else raw.optInt("correct")
    fun command(action: String): JSONObject = JSONObject().put("action", action).put("index", index).put("status", status)
        .put("slideIndex", presentation?.optInt("index", -1) ?: -1).put("step", presentation?.optInt("step") ?: 0)
    fun pulse(update: JSONObject): RoomSnapshot = RoomSnapshot(raw.copy().put("serverNow", update.optLong("serverNow", serverNow))
        .put("answeredCount", update.optInt("answeredCount", raw.optInt("answeredCount"))))
}
