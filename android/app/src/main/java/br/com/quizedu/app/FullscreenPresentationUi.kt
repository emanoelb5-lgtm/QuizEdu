package br.com.quizedu.app

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.os.SystemClock
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

private fun Context.activity(): Activity? = when (this) { is Activity -> this; is ContextWrapper -> baseContext.activity(); else -> null }

@Composable fun FullscreenPresentation(vm: QuizViewModel, state: RoomSnapshot) {
    val context = LocalContext.current
    val sequence = remember(state.code) { RankingSpotlightSequence() }
    var spotlightEnd by remember { mutableLongStateOf(0) }
    var showRanking by remember { mutableStateOf(false) }
    var controls by remember { mutableStateOf(true) }
    var touchedAt by remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    var closeConfirm by remember { mutableStateOf(false) }
    DisposableEffect(context) {
        val window = context.activity()?.window
        val keepOn = window?.attributes?.flags?.and(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) != 0
        val controller = window?.let { WindowCompat.getInsetsController(it, it.decorView) }
        controller?.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller?.hide(WindowInsetsCompat.Type.systemBars())
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose { controller?.show(WindowInsetsCompat.Type.systemBars()); if (!keepOn) window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }
    LaunchedEffect(state.code, state.status, state.index, state.presentation?.optBoolean("blackout"), state.presentation?.optBoolean("review")) {
        spotlightEnd = sequence.observe(state, SystemClock.elapsedRealtime())
    }
    LaunchedEffect(spotlightEnd) {
        val remaining = (spotlightEnd - SystemClock.elapsedRealtime()).coerceIn(0, 6000)
        showRanking = remaining > 0
        if (remaining > 0) { delay(remaining); showRanking = false }
    }
    LaunchedEffect(touchedAt, state.status) {
        controls = true
        if (state.status !in listOf("lobby", "finished", "closed")) { delay(3500); controls = false }
    }
    BoxWithConstraints(Modifier.fillMaxSize().background(Color.Black).testTag("fullscreen-presentation").pointerInput(Unit) {
        detectTapGestures { touchedAt = SystemClock.elapsedRealtime(); controls = true }
    }) {
        val presentation = state.presentation
        when {
            presentation?.optBoolean("blackout") == true -> Unit
            state.status == "lobby" -> Column(Modifier.align(Alignment.Center).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(state.title, color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                Text("Entre na sala ${state.code}", color = EduLime, fontSize = 28.sp)
                Text("${state.players.size} participantes", color = Color.White)
            }
            state.status in listOf("finished", "closed") -> Column(Modifier.align(Alignment.Center).widthIn(max = 700.dp).padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Text(if (state.status == "closed") "Sala encerrada" else "Aula concluída", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                Podium(state.players)
            }
            state.wordCloud != null -> Column(Modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(state.wordCloud!!.str("prompt"), color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Text("100 pontos por palavra · ${state.wordCloud!!.arr("words").length()} palavras", color = EduLime)
                AnimatedWordCloud(state.wordCloud!!.arr("words").objects(), Modifier.weight(1f).fillMaxWidth(), large = true)
            }
            state.status in listOf("question", "results") || presentation?.optBoolean("review") == true -> Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                LazyColumn(contentPadding = PaddingValues(20.dp), modifier = Modifier.fillMaxSize()) { item { QuestionPanel(vm, state, revealed = state.status != "question") } }
            }
            presentation?.optJSONObject("slide") != null -> {
                val width = minOf(maxWidth, maxHeight * (16f / 9f))
                SlideView(presentation.getJSONObject("slide"), Modifier.align(Alignment.Center).width(width), step = presentation.optInt("step"), fullscreen = true)
            }
        }
        if (showRanking && state.players.isNotEmpty()) Surface(color = EduNavy.copy(alpha = .96f), shape = MaterialTheme.shapes.large,
            modifier = Modifier.align(Alignment.TopEnd).padding(top = if (maxHeight < 400.dp) 16.dp else 72.dp, end = 16.dp).widthIn(max = 330.dp).testTag("ranking-spotlight")) {
            Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Text("Ranking da turma", color = EduLime, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                state.players.take(5).forEach { player -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text("${player.optInt("position")}º", color = EduLime, fontWeight = FontWeight.Bold)
                    PlayerAvatar(player.str("avatar"), 29.dp)
                    Text(player.str("name"), modifier = Modifier.weight(1f), color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(points(player.optInt("score")), color = Color.White, fontWeight = FontWeight.Bold)
                } }
            }
        }
        if (controls) {
            Surface(color = EduNavy.copy(alpha = .9f), shape = MaterialTheme.shapes.small, modifier = Modifier.align(Alignment.TopStart).padding(12.dp)) {
                TextButton(onClick = { vm.showFullscreen(false) }) { Icon(Icons.Default.FullscreenExit, null, tint = Color.White); Spacer(Modifier.width(6.dp)); Text("Sair da tela cheia", color = Color.White) }
            }
            if (state.status !in listOf("finished", "closed")) Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().widthIn(max = 900.dp)) {
                TeacherControls(vm, state, onClose = { closeConfirm = true })
            }
        }
    }
    if (closeConfirm) AlertDialog(onDismissRequest = { closeConfirm = false }, title = { Text("Encerrar a sala?") }, text = { Text("Os alunos deixam de responder. O relatório permanece na sua conta.") },
        confirmButton = { TextButton(onClick = { closeConfirm = false; vm.control("close") }) { Text("Encerrar sala") } }, dismissButton = { TextButton(onClick = { closeConfirm = false }) { Text("Continuar aula") } })
}
