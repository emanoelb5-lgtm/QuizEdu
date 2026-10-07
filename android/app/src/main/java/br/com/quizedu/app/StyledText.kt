package br.com.quizedu.app
import org.json.JSONArray
import org.json.JSONObject

private data class StyledCharacter(val char: Char, val marks: String)
private fun styledCharacters(node: JSONObject?): List<StyledCharacter> {
    if (node == null) return emptyList()
    if (node.str("type") == "text") return node.str("text").map { StyledCharacter(it, node.arr("marks").toString()) }
    if (node.str("type") == "hardBreak") return listOf(StyledCharacter('\n', "[]"))
    val out = mutableListOf<StyledCharacter>()
    node.arr("content").objects().forEachIndexed { index, child -> if (index > 0 && node.str("type") in listOf("doc", "bulletList", "orderedList")) out.add(StyledCharacter('\n', "[]")); out.addAll(styledCharacters(child)) }
    return out
}
private fun styledDocument(chars: List<StyledCharacter>, original: JSONObject?): JSONObject {
    val paragraphs = mutableListOf<JSONObject>(); val line = mutableListOf<StyledCharacter>()
    fun flush() {
        val runs = mutableListOf<JSONObject>(); var marks = ""; var content = StringBuilder()
        fun run() { if (content.isNotEmpty()) { val text = JSONObject().put("type", "text").put("text", content.toString()); if (marks != "[]") text.put("marks", JSONArray(marks)); runs.add(text); content = StringBuilder() } }
        line.forEach { if (marks != it.marks) { run(); marks = it.marks }; content.append(it.char) }; run()
        val p = JSONObject().put("type", "paragraph").put("content", jsonArray(runs)); original?.arr("content")?.optJSONObject(paragraphs.size)?.optJSONObject("attrs")?.let { p.put("attrs", it.copy()) }; paragraphs.add(p); line.clear()
    }
    chars.forEach { if (it.char == '\n') flush() else line.add(it) }; flush()
    return JSONObject().put("type", "doc").put("content", jsonArray(paragraphs))
}
fun replaceStyledText(original: JSONObject?, text: String): JSONObject {
    val old = styledCharacters(original); val oldText = old.joinToString("") { it.char.toString() }; var prefix = 0
    while (prefix < oldText.length && prefix < text.length && oldText[prefix] == text[prefix]) prefix++
    var suffix = 0; while (suffix < oldText.length - prefix && suffix < text.length - prefix && oldText[oldText.lastIndex - suffix] == text[text.lastIndex - suffix]) suffix++
    val marks = old.getOrNull((prefix - 1).coerceAtLeast(0))?.marks ?: "[]"
    val updated = old.take(prefix) + text.substring(prefix, text.length - suffix).map { StyledCharacter(it, marks) } + if (suffix > 0) old.takeLast(suffix) else emptyList()
    return styledDocument(updated, original)
}
fun formatStyledText(original: JSONObject?, start: Int, end: Int, type: String, attrs: JSONObject? = null): JSONObject {
    val chars = styledCharacters(original); val from = if (start == end) 0 else minOf(start, end).coerceIn(0, chars.size); val to = if (start == end) chars.size else maxOf(start, end).coerceIn(0, chars.size)
    val toggleOff = attrs == null && chars.subList(from, to).filter { it.char != '\n' }.all { JSONArray(it.marks).objects().any { m -> m.str("type") == type } }
    return styledDocument(chars.mapIndexed { index, character -> if (index !in from until to || character.char == '\n') character else {
        val marks = JSONArray(character.marks).objects(); val next = marks.filter { it.str("type") != type }.toMutableList()
        if (!toggleOff) next.add(JSONObject().put("type", type).also { if (attrs != null) it.put("attrs", if (type == "textStyle") (marks.find { m -> m.str("type") == "textStyle" }?.optJSONObject("attrs")?.copy() ?: JSONObject()).apply { attrs.keys().forEach { key -> put(key, attrs.get(key)) } } else attrs.copy()) })
        character.copy(marks = jsonArray(next).toString())
    } }, original)
}
