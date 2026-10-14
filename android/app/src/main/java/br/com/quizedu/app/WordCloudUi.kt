package br.com.quizedu.app

import android.graphics.Paint
import android.graphics.Typeface
import android.provider.Settings
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject
import kotlin.math.*

private data class CloudPlacement(val word: String, val x: Float, val y: Float, val size: Float, val hash: Int)
private data class CloudLayout(val words: List<CloudPlacement>, val height: Float)

@Composable fun AnimatedWordCloud(words: List<JSONObject>, modifier: Modifier = Modifier, large: Boolean = false) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val motion = remember(context) { Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f }
    val clock = if (motion && words.isNotEmpty()) {
        val transition = rememberInfiniteTransition(label = "nuvem")
        transition.animateFloat(0f, (2 * PI).toFloat(), infiniteRepeatable(tween(10000, easing = LinearEasing)), label = "movimento")
    } else remember { mutableFloatStateOf(0f) }
    Surface(color = EduNavy, shape = RoundedCornerShape(24.dp), modifier = modifier) {
        BoxWithConstraints(Modifier.background(Brush.linearGradient(listOf(Color(0xFF292047), Color(0xFF141B39))))) {
            if (words.isEmpty()) Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Text("A turma cria esta nuvem", color = Color.White, fontSize = if (large) 32.sp else 22.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp)); Text("As palavras aparecem aqui ao vivo.", color = Color(0xFFD6CEEF))
            } else {
                val width = maxWidth.value - 32
                val layout = remember(words.map { it.str("id") to it.str("word") }, width, density.density, density.fontScale, large) {
                    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create("sans-serif", Typeface.BOLD) }
                    val rows = mutableListOf<List<CloudPlacement>>()
                    var row = mutableListOf<CloudPlacement>(); var used = 0f
                    words.forEach { entry ->
                        val hash = entry.str("id").hashCode() and Int.MAX_VALUE
                        val maximum = if (large) (width / 18).coerceIn(24f, 68f) else (width / 12).coerceIn(16f, 30f)
                        var size = maximum * (.58f + (hash % 7) / 15f)
                        val word = entry.str("word")
                        paint.textSize = size * density.density * density.fontScale
                        var measured = paint.measureText(word) / density.density
                        if (measured > width - 20) { size *= (width - 20) / measured; measured = width - 20 }
                        if (row.isNotEmpty() && used + measured + 20 > width) { rows.add(row); row = mutableListOf(); used = 0f }
                        row.add(CloudPlacement(word, used + measured / 2 + 10, 0f, size, hash)); used += measured + 20
                    }
                    if (row.isNotEmpty()) rows.add(row)
                    var top = 20f
                    val placed = rows.flatMap { line ->
                        val height = line.maxOf { it.size } * density.fontScale * 1.6f + 6
                        val last = line.last(); paint.textSize = last.size * density.density * density.fontScale
                        val rowWidth = last.x + paint.measureText(last.word) / density.density / 2 + 10
                        val shift = (width - rowWidth) / 2 + 16
                        line.map { it.copy(x = it.x + shift, y = top + height * .7f) }.also { top += height }
                    }
                    CloudLayout(placed, (top + 20).coerceAtLeast(220f))
                }
                val paint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create("sans-serif", Typeface.BOLD); textAlign = Paint.Align.CENTER } }
                val colors = remember { listOf(Color(0xFFFBB86E), Color(0xFFBFA5FF), Color(0xFF79DFC9), Color(0xFFFF9BC4), Color.White).map { it.toArgb() } }
                Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    Canvas(Modifier.fillMaxWidth().height(layout.height.dp).semantics { contentDescription = "Nuvem de palavras: " + words.joinToString(", ") { it.str("word") } }) {
                        val phase = clock.value
                        layout.words.forEachIndexed { index, word ->
                            val angle = phase + word.hash % 100 / 16f
                            val animate = motion && index < 120
                            val scale = if (animate) .9f + .08f * sin(angle) else 1f
                            paint.textSize = word.size * density.density * density.fontScale * scale
                            paint.color = colors[word.hash % colors.size]
                            drawContext.canvas.nativeCanvas.drawText(word.word, word.x * density.density, (word.y + if (animate) sin(angle * 1.2f) * 2 else 0f) * density.density, paint)
                        }
                    }
                }
            }
        }
    }
}

@Composable fun WordCloudPanel(vm: QuizViewModel, state: RoomSnapshot) {
    val cloud = state.wordCloud ?: return
    val pending = vm.cloudPending?.takeIf { it.str("room") == state.code && it.str("player") == state.me?.str("id") && it.str("slideId") == cloud.str("slideId") }
    var word by rememberSaveable(state.code, cloud.str("slideId")) { mutableStateOf("") }
    var lastPending by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(pending?.str("writeId")) {
        if (lastPending != null && pending == null && !vm.cloudNoticeError) word = ""
        lastPending = pending?.str("writeId")
    }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(cloud.str("prompt"), fontSize = 24.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold)
        Text("100 pontos por palavra aceita · Envie quantas quiser, uma de cada vez.", color = EduBlue, fontWeight = FontWeight.Medium)
        if (state.presentation?.optBoolean("blackout") != true) AnimatedWordCloud(cloud.arr("words").objects(), Modifier.fillMaxWidth().height(260.dp).testTag("word-cloud"))
        else InfoCard("A nuvem está pausada no telão. Aguarde o professor continuar.")
        if (!vm.roomTeacher && state.me != null) {
            val context = LocalContext.current
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(vm.acceptedTerms, vm::acceptTerms)
                Text("Vou respeitar os colegas e a atividade.", modifier = Modifier.weight(1f))
            }
            TextButton(onClick = { openWeb(context, "/termos") }) { Text("Ler os combinados da sala") }
            OutlinedTextField(pending?.str("word") ?: word, { word = it.take(40) }, label = { Text("Sua palavra") }, singleLine = true, enabled = !vm.busy && pending == null,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions(onSend = { if (!vm.busy && vm.connected && vm.acceptedTerms && vmCanSendCloud(state)) vm.sendCloudWord(word) }), modifier = Modifier.fillMaxWidth().testTag("cloud-word-input"))
            Button(onClick = { vm.sendCloudWord(word) }, enabled = vm.acceptedTerms && !vm.busy && vm.connected && (pending != null || vmCanSendCloud(state)) && (pending != null || word.isNotBlank()), modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp).testTag("cloud-send")) {
                Icon(Icons.Default.Send, null); Spacer(Modifier.width(8.dp)); Text(if (pending != null) "Tentar novamente" else "Enviar palavra · +100")
            }
            if (pending != null) TextButton(onClick = vm::dismissPendingWord, enabled = !vm.busy) { Text("Digitar outra palavra") }
            vm.cloudNotice?.let { Text(it, color = if (vm.cloudNoticeError) MaterialTheme.colorScheme.error else EduBlue, modifier = Modifier.testTag("cloud-notice")) }
            if (!cloud.optBoolean("accepting")) Text("Envios pausados. Aguarde o professor continuar.", color = EduMuted)
            val mine = cloud.arr("myWords").objects()
            if (mine.isNotEmpty()) Text("Suas palavras: " + mine.joinToString(", ") { it.str("word") }, color = EduMuted)
        }
        Text("${cloud.arr("words").length()} palavras na nuvem", color = EduMuted)
    }
}
