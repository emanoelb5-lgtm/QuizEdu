package br.com.quizedu.app
import org.junit.Assert.*
import org.junit.Test
import org.json.JSONArray
import org.json.JSONObject

class ModelsTest {
    @Test fun editingImportedTextPreservesUnchangedRunStyles() {
        val original = richText("Solo vivo", bold = true)
        val changed = replaceStyledText(original, "Solo vivo e água")
        assertEquals("Solo vivo e água", plainText(changed))
        assertTrue(changed.toString().contains("bold"))
        val colored = formatStyledText(changed, 0, 4, "textStyle", JSONObject().put("color", "#ff0000"))
        assertEquals("Solo vivo e água", plainText(colored))
        assertEquals("#ff0000", colored.arr("content").getJSONObject(0).arr("content").getJSONObject(0).arr("marks").objects().first { it.str("type") == "textStyle" }.getJSONObject("attrs").str("color"))
        val last = colored.arr("content").getJSONObject(0).arr("content").objects().last()
        assertFalse(last.arr("marks").objects().any { it.str("type") == "textStyle" })
        val removed = replaceStyledText(colored, "Solo")
        assertEquals("Solo", plainText(removed))
        assertTrue(removed.toString().contains("#ff0000"))
    }
    @Test fun roomLinksRejectImpersonationAndAcceptSharedClassroomCodes() {
        assertEquals("123456", roomCode(" 123456 "))
        assertEquals("123456", roomCode(BuildConfig.SITE_URL + "/participar/123456"))
        assertEquals("123456", roomCode(BuildConfig.SITE_URL + "/participar/123456?origem=qr"))
        for (url in listOf("http://" + BuildConfig.SITE_URL.removePrefix("https://") + "/participar/123456", "https://quizedu-emanuel.emanuelb5.chatgpt.site.evil.test/participar/123456", "https://evil.test@quizedu-emanuel.emanuelb5.chatgpt.site/participar/123456", BuildConfig.SITE_URL + ":443/participar/123456", BuildConfig.SITE_URL + "/sala/123456", "12345", "1234567", "javascript:alert(1)")) assertNull(url, roomCode(url))
    }
    @Test fun duplicatesPreserveRichObjectsButGetNewIndependentIdentifiers() {
        val deck = newDeck(); val s = newSlide("title"); val group = uid()
        s.arr("elements").objects().forEach { it.put("group", group) }
        val e = newElement("chart", "azul"); e.put("futureAttribute", JSONObject().put("preserve", true)); s.arr("elements").put(e)
        val question = newSlide("question"); question.getJSONObject("question").put("text", "Quanto é 2 + 2?").put("options", JSONArray(listOf("4", "5"))).put("correct", 0)
        deck.put("slides", JSONArray().put(s).put(question))
        val copy = duplicateDeck(deck)
        assertNotEquals(deck.str("id"), copy.str("id"))
        assertNotEquals(s.str("id"), copy.arr("slides").getJSONObject(0).str("id"))
        val elements = copy.arr("slides").getJSONObject(0).arr("elements").objects()
        assertEquals(elements[0].str("group"), elements[1].str("group")); assertNotEquals(group, elements[0].str("group"))
        assertTrue(elements.last().getJSONObject("futureAttribute").getBoolean("preserve"))
        assertNotEquals(question.getJSONObject("question").str("id"), copy.arr("slides").getJSONObject(1).getJSONObject("question").str("id"))
        elements[0].put("doc", richText("Edição da cópia")); assertNotEquals("Edição da cópia", plainText(s.arr("elements").getJSONObject(0).optJSONObject("doc")))
        assertNull(validateLesson(copy))
    }
    @Test fun allThemesAndLayoutsFitTheSharedSixteenByNineCanvas() {
        for (theme in deckThemes) for (layout in listOf("cover", "title", "columns", "image", "quote", "section", "table", "chart", "closing", "blank", "question", "true_false")) {
            val slide = newSlide(layout, theme.id)
            assertEquals(theme.background, slide.getJSONObject("background").str("color"))
            for (e in slide.arr("elements").objects()) { assertTrue(e.optDouble("x") >= 0); assertTrue(e.optDouble("y") >= 0); assertTrue(e.optDouble("w") >= 12); assertTrue(e.optDouble("h") >= 8); assertTrue(e.optDouble("x") + e.optDouble("w") <= 1000.1); assertTrue(e.optDouble("y") + e.optDouble("h") <= 562.6) }
        }
    }
    @Test fun movingAndResizingCannotEscapeTheSharedCanvas() {
        val element = newElement("text", "azul")
        val moved = boundedGeometry(element, 999f, -90f)
        assertEquals(520.0, moved.optDouble("x"), .01); assertEquals(0.0, moved.optDouble("y"), .01)
        val giant = boundedGeometry(element, -10f, Float.NaN, Float.POSITIVE_INFINITY, 10000f)
        assertEquals(480.0, giant.optDouble("w"), .01); assertEquals(562.5, giant.optDouble("h"), .01); assertEquals(0.0, giant.optDouble("y"), .01)
        val tiny = boundedGeometry(element, 0f, 0f, -50f, -1f)
        assertEquals(12.0, tiny.optDouble("w"), .01); assertEquals(8.0, tiny.optDouble("h"), .01)
        assertEquals(80, element.optInt("x"))
    }
    @Test fun incompleteQuestionsCanBeDraftedButCannotStartAClass() {
        val deck = newDeck().put("slides", JSONArray().put(newSlide("question")))
        assertNotNull(validateLesson(deck))
        val question = deck.arr("slides").getJSONObject(0).getJSONObject("question")
        question.put("text", "Qual opção?").put("options", JSONArray(listOf("A", "a"))).put("correct", 0)
        assertNotNull(validateLesson(deck))
        question.put("options", JSONArray(listOf("Primeira", "Segunda"))); assertNull(validateLesson(deck))
        question.put("correct", -1); assertNotNull(validateLesson(deck))
    }
    @Test fun controlsCarryTheWholeServerRevisionAndPulseKeepsPrivateState() {
        val state = RoomSnapshot(JSONObject().put("code", "123456").put("index", 2).put("status", "slide").put("serverNow", 1000).put("answeredCount", 1)
            .put("presentation", JSONObject().put("index", 7).put("step", 3)).put("me", JSONObject().put("name", "Ana").put("score", 1400)))
        val command = state.command("next")
        assertEquals("slide", command.str("status")); assertEquals(2, command.optInt("index")); assertEquals(7, command.optInt("slideIndex")); assertEquals(3, command.optInt("step"))
        val pulse = state.pulse(JSONObject().put("serverNow", 2000).put("answeredCount", 2))
        assertEquals(2000L, pulse.serverNow); assertEquals(1400, pulse.me!!.optInt("score")); assertEquals(1000L, state.serverNow)
        assertFalse(command.has("correct")); assertFalse(command.has("score"))
    }
    @Test fun credentialsAreHighEntropyAndMediaNeverLoadsUntrustedOrigins() {
        val one = randomToken(); val two = randomToken()
        assertTrue(one.matches(Regex("[a-f0-9]{64}"))); assertNotEquals(one, two)
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", sha256("abc"))
        assertNotNull(mediaUrl("/api/media/" + uid())); assertNull(mediaUrl("https://evil.test/image.jpg")); assertNull(mediaUrl("/api/media/../../private"))
        assertEquals("dQw4w9WgXcQ", videoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")); assertNull(videoId("https://evil.test/watch?v=dQw4w9WgXcQ"))
    }
}
