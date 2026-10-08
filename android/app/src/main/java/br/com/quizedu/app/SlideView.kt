package br.com.quizedu.app

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

fun hexColor(value: String, fallback: Color = EduNavy): Color = try {
    if (!value.matches(Regex("#[a-fA-F0-9]{3}(?:[a-fA-F0-9]{3})?"))) fallback
    else Color(android.graphics.Color.parseColor(if (value.length == 4) "#" + value.drop(1).map { "$it$it" }.joinToString("") else value))
} catch (_: Exception) { fallback }
private fun family(value: String): FontFamily = when (value) { "Georgia", "Times New Roman" -> FontFamily.Serif; "Courier New" -> FontFamily.Monospace; else -> FontFamily.SansSerif }
fun annotatedRichText(doc: JSONObject?, scale: Float, baseSize: Float): AnnotatedString {
    val builder = AnnotatedString.Builder()
    fun write(node: JSONObject, listDepth: Int = 0) {
        val type = node.str("type")
        if (type == "text") {
            val start = builder.length
            val marks = node.arr("marks").objects()
            val style = marks.find { it.str("type") == "textStyle" }?.optJSONObject("attrs")
            val size = style?.str("fontSize")?.removeSuffix("px")?.toFloatOrNull()
            val decorations = mutableListOf<TextDecoration>()
            if (marks.any { it.str("type") == "underline" }) decorations.add(TextDecoration.Underline)
            if (marks.any { it.str("type") == "strike" }) decorations.add(TextDecoration.LineThrough)
            val link = marks.find { it.str("type") == "link" }?.optJSONObject("attrs")?.str("href")
            builder.pushStyle(SpanStyle(fontWeight = if (marks.any { it.str("type") == "bold" }) FontWeight.Bold else null,
                fontStyle = if (marks.any { it.str("type") == "italic" }) FontStyle.Italic else null,
                textDecoration = if (decorations.isNotEmpty()) TextDecoration.combine(decorations) else null,
                color = style?.str("color")?.takeIf { it.isNotEmpty() }?.let { hexColor(it) } ?: Color.Unspecified,
                fontSize = size?.takeIf { it.isFinite() && it in 8f..160f }?.let { (it * scale).sp } ?: androidx.compose.ui.unit.TextUnit.Unspecified,
                fontFamily = style?.str("fontFamily")?.takeIf { it.isNotBlank() }?.let(::family)))
            builder.append(node.str("text")); builder.pop()
            if (link != null && (link.startsWith("https://") || link.startsWith("http://")))
                builder.addLink(LinkAnnotation.Url(link, TextLinkStyles(SpanStyle(textDecoration = TextDecoration.Underline))), start, builder.length)
            return
        }
        if (type == "hardBreak") { builder.append("\n"); return }
        val content = node.arr("content").objects()
        when (type) {
            "doc" -> content.forEachIndexed { i, child -> if (i > 0) builder.append("\n"); write(child) }
            "bulletList", "orderedList" -> content.forEachIndexed { i, child ->
                if (i > 0) builder.append("\n")
                builder.append("  ".repeat(listDepth) + if (type == "bulletList") "• " else "${i + 1}. "); write(child, listDepth + 1)
            }
            "heading" -> { builder.pushStyle(SpanStyle(fontWeight = FontWeight.Bold, fontSize = (baseSize * scale * 1.15f).sp)); content.forEach { write(it, listDepth) }; builder.pop() }
            "blockquote" -> { builder.pushStyle(SpanStyle(fontStyle = FontStyle.Italic)); content.forEach { write(it, listDepth) }; builder.pop() }
            else -> content.forEachIndexed { i, child -> if (i > 0 && type == "listItem") builder.append("\n"); write(child, listDepth) }
        }
    }
    doc?.let { write(it) }
    return builder.toAnnotatedString()
}

@Composable fun SlideView(slide: JSONObject, modifier: Modifier = Modifier, step: Int = Int.MAX_VALUE,
    selected: String? = null, editable: Boolean = false, onSelect: (String?) -> Unit = {}, onDrag: (String, Float, Float) -> Unit = { _, _, _ -> }, onResize: (String, Float, Float) -> Unit = { _, _, _ -> }, selectedIds: Set<String> = emptySet(), imageOverrides: Map<String, ByteArray> = emptyMap()) {
    val density = LocalDensity.current
    val background = slide.optJSONObject("background") ?: JSONObject()
    BoxWithConstraints(modifier.aspectRatio(16f / 9f).clip(RoundedCornerShape(10.dp)).background(hexColor(background.str("color", "#ffffff")))) {
        val scale = maxWidth.value / SLIDE_W
        val pixelScale = scale * density.density
        val textScale = scale / density.fontScale
        if (background.str("color2").isNotBlank()) {
            val angle = background.optDouble("angle", 135.0) * PI / 180.0
            Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(hexColor(background.str("color")), hexColor(background.str("color2"))),
                start = Offset.Zero, end = Offset((cos(angle).toFloat() + 1f) * maxWidth.value * density.density / 2, (sin(angle).toFloat() + 1f) * maxHeight.value * density.density / 2))))
        }
        (imageOverrides[background.str("image")] ?: mediaUrl(background.str("image")))?.let { AsyncImage(it, "Fundo do slide", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
        val overlay = background.optDouble("overlay", 0.0).toFloat().coerceIn(0f, 90f) / 100f
        if (overlay > 0f) Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = overlay)))
        if (editable) Box(Modifier.fillMaxSize().clickable { onSelect(null) })
        if (slide.str("kind") == "question") {
            val question = slide.optJSONObject("question")
            Column(Modifier.fillMaxSize().padding((50 * scale).dp), verticalArrangement = Arrangement.spacedBy((24 * scale).dp)) {
                Text("PERGUNTA PARA A TURMA", fontSize = (20 * textScale).sp, color = EduBlue, fontWeight = FontWeight.Bold)
                Text(question?.str("text")?.ifBlank { "Escreva sua pergunta" } ?: "Pergunta", fontSize = (43 * textScale).sp, color = hexColor(background.str("color"), Color.White).let { if (it == EduNavy) Color.White else EduNavy }, fontWeight = FontWeight.Bold, lineHeight = (51 * textScale).sp, maxLines = 3)
                question?.arr("options")?.strings()?.chunked(2)?.forEachIndexed { row, options -> Row(horizontalArrangement = Arrangement.spacedBy((18 * scale).dp)) {
                    options.forEachIndexed { column, option -> Box(Modifier.weight(1f).background(Color(0xFFF0EDFF), RoundedCornerShape((8 * scale).dp)).padding((16 * scale).dp)) {
                        Text("${('A'.code + row * 2 + column).toChar()}  ${option.ifBlank { "Alternativa" }}", fontSize = (22 * textScale).sp, color = EduNavy, maxLines = 2)
                    }
                } } }
            }
        }
        slide.arr("elements").objects().filter { !it.optBoolean("hidden") && (editable || it.optInt("build") <= step) }.forEach { e ->
            val id = e.str("id")
            var elementModifier = Modifier.offset((e.optDouble("x").toFloat() * scale).dp, (e.optDouble("y").toFloat() * scale).dp)
                .size((e.optDouble("w").toFloat() * scale).dp, (e.optDouble("h").toFloat() * scale).dp)
                .graphicsLayer { rotationZ = e.optDouble("rotation").toFloat(); alpha = e.optDouble("opacity", 100.0).toFloat() / 100f }
            if (editable) {
                elementModifier = elementModifier.clickable { onSelect(id) }
                if (!e.optBoolean("locked")) elementModifier = elementModifier.pointerInput(id, pixelScale) {
                    detectDragGestures(onDragStart = { onSelect(id) }) { change, amount -> change.consume(); onDrag(id, amount.x / pixelScale, amount.y / pixelScale) }
                }
                if (selected == id || id in selectedIds) elementModifier = elementModifier.border(2.dp, EduBlue)
            }
            Box(elementModifier.clip(RoundedCornerShape((e.optDouble("radius", 0.0).toFloat() * scale).dp))) { SlideObject(e, textScale, scale, editable, imageOverrides) }
            if (editable && selected == id && !e.optBoolean("locked")) Box(Modifier.offset(((e.optDouble("x") + e.optDouble("w")).toFloat() * scale - 16).dp, ((e.optDouble("y") + e.optDouble("h")).toFloat() * scale - 16).dp).size(32.dp).pointerInput(id, pixelScale) { detectDragGestures { change, amount -> change.consume(); onResize(id, amount.x / pixelScale, amount.y / pixelScale) } }, contentAlignment = Alignment.Center) { Box(Modifier.size(14.dp).background(EduBlue, RoundedCornerShape(3.dp)).border(2.dp, Color.White, RoundedCornerShape(3.dp))) }
        }
    }
}

@Composable private fun SlideObject(e: JSONObject, textScale: Float, scale: Float, editable: Boolean, imageOverrides: Map<String, ByteArray>) {
    val context = LocalContext.current
    when (e.str("type")) {
        "text" -> {
            val size = e.optDouble("fontSize", 30.0).toFloat()
            Text(annotatedRichText(e.optJSONObject("doc"), textScale, size), fontSize = (size * textScale).sp, lineHeight = (size * textScale * 1.2f).sp,
                fontFamily = family(e.str("font")), color = hexColor(e.str("color")), textAlign = when (e.str("align")) { "center" -> TextAlign.Center; "right" -> TextAlign.Right; "justify" -> TextAlign.Justify; else -> TextAlign.Left }, modifier = Modifier.fillMaxSize(), overflow = TextOverflow.Clip)
        }
        "image" -> if (imageOverrides[e.str("src")] != null || mediaUrl(e.str("src")) != null) AsyncImage(imageOverrides[e.str("src")] ?: mediaUrl(e.str("src")), e.str("alt", "Imagem do slide"), modifier = Modifier.fillMaxSize(),
            contentScale = if (e.str("fit") == "contain") ContentScale.Fit else ContentScale.Crop,
            alignment = BiasAlignment((e.optDouble("positionX", 50.0).toFloat() - 50f) / 50f, (e.optDouble("positionY", 50.0).toFloat() - 50f) / 50f))
        else Box(Modifier.fillMaxSize().background(Color(0xFFF0EDFF)), contentAlignment = Alignment.Center) { Icon(Icons.Default.Image, "Imagem ainda não adicionada", tint = EduMuted, modifier = Modifier.size((70 * scale).dp)) }
        "shape" -> Canvas(Modifier.fillMaxSize()) {
            val fill = hexColor(e.str("fill"), Color.Transparent).copy(alpha = e.optDouble("fillOpacity", 100.0).toFloat().coerceIn(0f, 100f) / 100f)
            val stroke = hexColor(e.str("stroke"), Color.Transparent)
            val thickness = e.optDouble("strokeWidth", 0.0).toFloat() * scale * density
            val line = Stroke(thickness.coerceAtLeast(.1f))
            when (e.str("shape")) {
                "ellipse" -> { drawOval(fill); if (thickness > 0) drawOval(stroke, style = line) }
                "triangle" -> { val path = Path().apply { moveTo(size.width / 2, 0f); lineTo(size.width, size.height); lineTo(0f, size.height); close() }; drawPath(path, fill); if (thickness > 0) drawPath(path, stroke, style = line) }
                "line", "arrow" -> {
                    drawLine(stroke, Offset(0f, size.height / 2), Offset(size.width, size.height / 2), thickness.coerceAtLeast(1f))
                    if (e.str("shape") == "arrow") { val head = (size.width * .1f).coerceAtMost(size.height / 2); drawLine(stroke, Offset(size.width - head, size.height / 2 - head), Offset(size.width, size.height / 2), thickness.coerceAtLeast(1f)); drawLine(stroke, Offset(size.width - head, size.height / 2 + head), Offset(size.width, size.height / 2), thickness.coerceAtLeast(1f)) }
                }
                else -> { val radius = e.optDouble("radius", 0.0).toFloat() * scale * density; drawRoundRect(fill, cornerRadius = CornerRadius(radius)); if (thickness > 0) drawRoundRect(stroke, cornerRadius = CornerRadius(radius), style = line) }
            }
        }
        "table" -> {
            val rows = e.arr("cells"); val rowCount = rows.length().coerceAtLeast(1)
            Column(Modifier.fillMaxSize().border(1.dp, Color(0xFFC9D4E8))) {
                for (r in 0 until rowCount) {
                    val cells = rows.optJSONArray(r)?.strings() ?: emptyList()
                    Row(Modifier.weight(1f)) { cells.forEach { cell ->
                        Box(Modifier.weight(1f).fillMaxHeight().background(if (r == 0 && e.optBoolean("header")) hexColor(e.str("fill"), EduBlue) else if (r % 2 == 0) Color(0xFFF3F6FC) else Color.White).border(.5.dp, Color(0xFFD4DDED)).padding((9 * scale).dp)) {
                            Text(cell, fontSize = (e.optDouble("fontSize", 24.0).toFloat() * textScale).sp, lineHeight = (e.optDouble("fontSize", 24.0).toFloat() * textScale * 1.2f).sp,
                                color = if (r == 0 && e.optBoolean("header")) Color.White else hexColor(e.str("color")), fontWeight = if (r == 0 && e.optBoolean("header")) FontWeight.Bold else FontWeight.Normal)
                        }
                    } }
                }
            }
        }
        "chart" -> ChartView(e, scale)
        "video" -> {
            val id = e.str("videoId").takeIf { it.matches(Regex("[\\w-]{11}")) }
            Box(Modifier.fillMaxSize().background(EduNavy).then(if (!editable && id != null) Modifier.clickable { openWeb(context, "https://www.youtube.com/watch?v=$id&t=${e.optInt("videoStart")}s") } else Modifier), contentAlignment = Alignment.Center) {
                if (id != null) AsyncImage("https://i.ytimg.com/vi/$id/hqdefault.jpg", "Vídeo do slide", contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
                Icon(Icons.Default.PlayCircle, "Abrir vídeo no YouTube", tint = Color.White, modifier = Modifier.size((95 * scale).dp))
            }
        }
    }
}
@Composable private fun ChartView(e: JSONObject, scale: Float) {
    val labels = e.arr("labels").strings()
    val values = (0 until e.arr("values").length()).map { e.arr("values").optDouble(it).toFloat().coerceAtLeast(0f) }
    val accent = hexColor(e.str("fill"), EduBlue)
    val text = hexColor(e.str("color"))
    Canvas(Modifier.fillMaxSize()) {
        if (values.isEmpty()) return@Canvas
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = text.toArgb(); textSize = e.optDouble("fontSize", 20.0).toFloat() * scale * density; textAlign = Paint.Align.CENTER }
        val bottom = size.height - paint.textSize * 2.2f
        val height = (bottom - paint.textSize * 1.8f).coerceAtLeast(1f)
        val maximum = max(values.maxOrNull() ?: 1f, 1f)
        val gap = size.width / values.size
        if (e.str("chart") == "pie") {
            val total = values.sum().coerceAtLeast(1f)
            val diameter = (size.height * .82f).coerceAtMost(size.width * .6f)
            var start = -90f
            val colors = listOf(accent, Color(0xFF37B99C), Color(0xFFFFB84D), Color(0xFF9466EE), Color(0xFFEE7298), Color(0xFF629DEE))
            values.forEachIndexed { i, value -> val sweep = value / total * 360f; drawArc(colors[i % colors.size], start, sweep, true, topLeft = Offset(0f, 0f), size = Size(diameter, diameter)); start += sweep
                paint.textAlign = Paint.Align.LEFT; paint.color = colors[i % colors.size].toArgb(); drawContext.canvas.nativeCanvas.drawText("${labels.getOrElse(i) { "Item ${i + 1}" }}: ${value.toInt()}", diameter + paint.textSize, (i + 1) * paint.textSize * 1.7f, paint) }
        } else {
            val path = Path()
            values.forEachIndexed { i, value ->
                val x = gap * (i + .5f); val y = bottom - value / maximum * height
                if (e.str("chart") == "line") { if (i == 0) path.moveTo(x, y) else path.lineTo(x, y); drawCircle(accent, (4 * scale * density).coerceAtLeast(2f), Offset(x, y)) }
                else drawRoundRect(accent, Offset(gap * i + gap * .18f, y), Size(gap * .64f, (bottom - y).coerceAtLeast(1f)), CornerRadius(3 * scale * density))
                drawContext.canvas.nativeCanvas.drawText(value.toInt().toString(), x, (y - paint.textSize * .4f).coerceAtLeast(paint.textSize), paint)
                drawContext.canvas.nativeCanvas.drawText(labels.getOrElse(i) { "Item ${i + 1}" }.take(16), x, bottom + paint.textSize * 1.5f, paint)
            }
            if (e.str("chart") == "line") drawPath(path, accent, style = Stroke((3 * scale * density).coerceAtLeast(1f)))
        }
    }
}
