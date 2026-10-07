package br.com.quizedu.app

import android.graphics.Bitmap
import android.os.SystemClock
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.ceil

fun points(value: Int): String = NumberFormat.getIntegerInstance(Locale("pt", "BR")).format(value)
@Composable fun RoomScreen(vm: QuizViewModel) {
    val state = vm.room
    var closeConfirm by remember { mutableStateOf(false) }
    if (state == null || (vm.roomTeacher && (!state.isHost || vm.roomError != null))) {
        Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(25.dp))
            if (vm.roomError == null) CircularProgressIndicator()
            Text(vm.roomError ?: "Conectando à sala ${vm.currentCode}…", style = MaterialTheme.typography.titleLarge)
            Text("Seu nome e sua pontuação serão retomados neste aparelho.", color = EduMuted)
            TextButton(onClick = vm::leaveRoom) { Text("Entrar em outra sala") }
        }
        return
    }
    if (state.status == "closed") {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) { Heading("Esta sala foi encerrada.", "Peça ao professor o código da próxima aula."); Button(onClick = vm::leaveRoom) { Text("Entrar em outra sala") } }
        return
    }
    if (!vm.roomTeacher && state.me == null && state.status != "finished") { JoinScreen(vm, state); return }
    val context = LocalContext.current
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text(state.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis); Text("Sala ${state.code} · ${state.raw.str("teacher")}", color = EduMuted, fontSize = 13.sp) }
            if (!vm.roomTeacher) state.me?.let { Text(it.str("avatar"), fontSize = 32.sp) }
        } }
        if (!vm.connected) item { InfoCard("Reconectando à sala. Sua participação e seus pontos foram preservados. As respostas precisam de conexão para serem enviadas.", true) }
        if (vm.roomTeacher) item { TeacherControls(vm, state, onClose = { closeConfirm = true }) }
        when (state.status) {
            "lobby" -> {
                if (vm.roomTeacher) item { LobbyInvite(state.code) }
                else item { Surface(color = EduNavy, shape = RoundedCornerShape(24.dp)) { Column(Modifier.fillMaxWidth().padding(25.dp), verticalArrangement = Arrangement.spacedBy(13.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(state.me?.str("avatar") ?: "🦊", fontSize = 60.sp)
                    Text("Você está na sala!", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    Text("${state.me?.str("name")}, aguarde o professor iniciar a aula.", color = Color(0xFFD6DEEF))
                } } }
                item { Text("${state.players.size} participantes", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium) }
                itemsIndexed(state.players, key = { _, p -> p.str("id") }) { _, player -> PlayerRow(player, state.me?.str("id"), showScore = false, onRemove = if (vm.roomTeacher) { { vm.control("kick", playerId = player.str("id")) } } else null) }
            }
            "slide" -> {
                val presentation = state.presentation
                val slide = presentation?.optJSONObject("slide")
                if (presentation?.optBoolean("blackout") == true) item { Surface(color = Color.Black, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f)) { Box(contentAlignment = Alignment.Center) { Text("Atenção à explicação do professor", color = Color.White) } } }
                else if (slide != null) item { SlideView(slide, Modifier.fillMaxWidth(), step = presentation.optInt("step")) }
                if (presentation != null) item { Text("Slide ${presentation.optInt("index") + 1} de ${presentation.optInt("total")}${if (presentation.optBoolean("review")) " · Revisão" else ""}", color = EduMuted) }
                if (state.question != null && presentation?.optBoolean("review") == true) item { QuestionPanel(vm, state, revealed = true) }
                if (!vm.roomTeacher) item { InfoCard("Acompanhe a explicação. As perguntas aparecem aqui quando o professor avançar a aula.") }
            }
            "question" -> item { QuestionPanel(vm, state, revealed = false) }
            "results" -> {
                item { Heading("Resultado da rodada", "Os pontos somam ao longo de toda a aula.") }
                item { QuestionPanel(vm, state, revealed = true) }
            }
            "finished" -> {
                item { Heading("Uma turma, muitas conquistas.", "Placar final da aula") }
                item { Podium(state.players) }
                if (!vm.roomTeacher) item { state.me?.let { InfoCard("${it.str("name")}, você fez ${points(it.optInt("score"))} pontos e ficou em ${it.optInt("position")}º lugar.") } }
            }
        }
        if (vm.roomTeacher) state.presentation?.optJSONObject("slide")?.str("notes")?.takeIf { it.isNotBlank() }?.let { notes -> item { OutlinedCard { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Text("Anotações privadas", fontWeight = FontWeight.Bold); Text(notes, color = EduMuted) } } } }
        if (state.status in listOf("slide", "question", "results", "finished")) {
            item { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Text("Classificação", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f)); if (state.question != null && state.status != "finished") Text("${state.raw.optInt("answeredCount")}/${state.players.size} respostas", color = EduMuted, fontSize = 12.sp) } }
            val ranked = if (state.status == "finished") state.players.drop(2) else state.players
            itemsIndexed(ranked, key = { _, p -> p.str("id") }) { _, player -> PlayerRow(player, state.me?.str("id")) }
        }
        if (vm.roomTeacher && state.status != "finished") state.presentation?.arr("outline")?.objects()?.let { outline ->
            item { Text("Roteiro da aula", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
            itemsIndexed(outline, key = { _, s -> "outline-${s.str("id")}" }) { index, s ->
                OutlinedButton(onClick = { vm.control("goto", target = index) }, enabled = !vm.busy && vm.connected && state.status in listOf("slide", "results"), modifier = Modifier.fillMaxWidth()) {
                    Icon(if (s.str("kind") == "question") Icons.Default.Quiz else Icons.Default.AutoAwesomeMotion, null)
                    Spacer(Modifier.width(9.dp)); Text("${index + 1}. ${s.str("title")}", modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        if (vm.roomTeacher) item { TextButton(onClick = { openWeb(context, "/sala/${state.code}/tela") }) { Icon(Icons.Default.OpenInBrowser, null); Spacer(Modifier.width(8.dp)); Text("Abrir tela da apresentação no navegador") } }
        if (state.status == "finished") item { Button(onClick = vm::leaveRoom, modifier = Modifier.fillMaxWidth()) { Text(if (vm.roomTeacher) "Voltar às minhas aulas" else "Entrar em outra sala") } }
    }
    if (closeConfirm) AlertDialog(onDismissRequest = { closeConfirm = false }, title = { Text("Encerrar a sala?") }, text = { Text("Os alunos deixam de responder. O relatório da aula permanece disponível na conta do professor.") }, confirmButton = { TextButton(onClick = { closeConfirm = false; vm.control("close") }) { Text("Encerrar sala") } }, dismissButton = { TextButton(onClick = { closeConfirm = false }) { Text("Continuar aula") } })
}
@Composable private fun JoinScreen(vm: QuizViewModel, state: RoomSnapshot) {
    var name by rememberSaveable(state.code) { mutableStateOf(vm.repository.preferences.getString("student_name", "") ?: "") }
    var avatar by rememberSaveable(state.code) { mutableStateOf(vm.repository.preferences.getString("student_avatar", "🦊") ?: "🦊") }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item { Heading("Você chegou!", "${state.title} · Sala ${state.code}") }
        item { OutlinedTextField(name, { name = it.take(24) }, label = { Text("Como você quer aparecer?") }, singleLine = true, keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words), modifier = Modifier.fillMaxWidth()) }
        item { Text("Escolha seu avatar", fontWeight = FontWeight.Bold) }
        item { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { avatars.chunked(4).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { row.forEach { item ->
            FilledTonalButton(onClick = { avatar = item }, colors = ButtonDefaults.filledTonalButtonColors(containerColor = if (avatar == item) Color(0xFFDDE4FF) else Color.White), modifier = Modifier.weight(1f).height(63.dp), contentPadding = PaddingValues(4.dp)) { Text(item, fontSize = 28.sp) }
        } } } } }
        item { Button(onClick = { vm.join(name.trim(), avatar) }, enabled = !vm.busy && vm.connected && name.trim().length >= 2, modifier = Modifier.fillMaxWidth().height(54.dp)) { Text("Entrar e participar", fontWeight = FontWeight.Bold) } }
        if (state.status in listOf("question", "results")) item { InfoCard("A turma está respondendo. Quem já entrou pode retomar com o mesmo aparelho. Em uma aula com slides, novos participantes podem entrar quando o professor passar para um slide de conteúdo.") }
        item { TextButton(onClick = vm::leaveRoom) { Text("Usar outro código") } }
    }
}
@Composable private fun LobbyInvite(code: String) {
    val bitmap = remember(code) {
        val matrix = QRCodeWriter().encode("${BuildConfig.SITE_URL}/participar/$code", BarcodeFormat.QR_CODE, 480, 480)
        Bitmap.createBitmap(480, 480, Bitmap.Config.ARGB_8888).apply { setPixels(IntArray(480 * 480) { i -> if (matrix[i % 480, i / 480]) android.graphics.Color.BLACK else android.graphics.Color.WHITE }, 0, 480, 0, 0, 480, 480) }
    }
    OutlinedCard { Column(Modifier.fillMaxWidth().padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Convide a turma", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Image(bitmap.asImageBitmap(), "QR code para entrar na sala $code", modifier = Modifier.size(185.dp))
        Text(code, fontSize = 40.sp, letterSpacing = 4.sp, fontWeight = FontWeight.ExtraBold, color = EduBlue)
        Text("No Android: abra o QuizEdu e toque em “Ler QR code”. No navegador: leia o QR code ou digite o código da sala.", color = EduMuted)
        InfoCard("No computador, abra esta sala no QuizEdu com a mesma conta. O celular passa a controlar a apresentação e o placar.")
    } }
}
@Composable private fun TeacherControls(vm: QuizViewModel, state: RoomSnapshot, onClose: () -> Unit) {
    OutlinedCard { Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Controle do professor", color = EduBlue, fontWeight = FontWeight.Bold)
        val enabled = !vm.busy && vm.connected && state.isHost
        if (state.status == "lobby") Button(onClick = { vm.control("start") }, enabled = enabled, modifier = Modifier.fillMaxWidth().height(52.dp)) { Icon(Icons.Default.PlayArrow, null); Spacer(Modifier.width(8.dp)); Text("Iniciar aula") }
        else if (state.status != "finished") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (state.presentation != null) OutlinedButton(onClick = { vm.control("previous") }, enabled = enabled && state.presentation!!.optInt("index") > 0 && state.status != "question", modifier = Modifier.weight(1f)) { Icon(Icons.Default.SkipPrevious, null); Text("Anterior") }
                Button(onClick = { vm.control(if (state.status == "question") "end_round" else "next") }, enabled = enabled, modifier = Modifier.weight(1f)) {
                    Text(if (state.status == "question") "Revelar resultado" else "Próximo"); Spacer(Modifier.width(5.dp)); Icon(Icons.Default.SkipNext, null)
                }
            }
            if (state.presentation != null) OutlinedButton(onClick = { vm.control("blackout") }, enabled = enabled && state.status in listOf("slide", "results"), modifier = Modifier.fillMaxWidth()) { Icon(if (state.presentation!!.optBoolean("blackout")) Icons.Default.Visibility else Icons.Default.VisibilityOff, null); Spacer(Modifier.width(8.dp)); Text(if (state.presentation!!.optBoolean("blackout")) "Mostrar apresentação" else "Escurecer tela do computador") }
        }
        if (state.status != "finished") TextButton(onClick = onClose, enabled = enabled) { Text("Encerrar sala") }
    } }
}
@Composable private fun QuestionPanel(vm: QuizViewModel, state: RoomSnapshot, revealed: Boolean) {
    val question = state.question ?: return
    var elapsed by remember { mutableStateOf(SystemClock.elapsedRealtime()) }
    LaunchedEffect(state.status, state.startsAt, vm.receivedAt) { while (!revealed) { elapsed = SystemClock.elapsedRealtime(); delay(200) } }
    val now = state.serverNow + (elapsed - vm.receivedAt).coerceAtLeast(0)
    val countdown = ceil((state.startsAt - now).coerceAtLeast(0) / 1000.0).toInt()
    val seconds = ceil((state.endsAt - now).coerceAtLeast(0) / 1000.0).toInt()
    val ready = countdown == 0
    val over = state.endsAt > 0 && seconds == 0
    val answered = state.me?.optBoolean("answered") == true
    OutlinedCard { Column(Modifier.padding(20.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Pergunta ${state.index + 1} de ${state.total}", color = EduMuted, modifier = Modifier.weight(1f))
            if (!revealed) Text(if (!ready) "Começa em $countdown" else if (state.endsAt == 0L) "Tempo livre" else "${seconds}s", color = EduBlue, fontWeight = FontWeight.Bold)
        }
        Text(question.str("text"), fontSize = 24.sp, lineHeight = 30.sp, fontWeight = FontWeight.ExtraBold)
        mediaUrl(question.str("image"))?.let { AsyncImage(it, question.str("imageAlt", "Imagem da pergunta"), modifier = Modifier.fillMaxWidth().heightIn(max = 250.dp)) }
        question.arr("options").strings().forEachIndexed { index, text ->
            val isCorrect = revealed && state.correct == index
            val selected = state.me?.optInt("option", -1) == index && !state.me!!.isNull("option")
            val background = if (isCorrect) Color(0xFFE3F5E9) else if (selected) Color(0xFFEAF0FF) else Color.White
            OutlinedButton(onClick = { vm.answer(index) }, enabled = !vm.roomTeacher && !vm.busy && vm.connected && ready && !over && !answered && !revealed,
                colors = ButtonDefaults.outlinedButtonColors(containerColor = background, disabledContainerColor = background, disabledContentColor = EduNavy), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), contentPadding = PaddingValues(15.dp)) {
                Text(('A'.code + index).toChar().toString(), color = if (isCorrect) Color(0xFF168653) else EduBlue, fontWeight = FontWeight.Bold, modifier = Modifier.width(28.dp))
                Column(Modifier.weight(1f)) { Text(text); mediaUrl(question.arr("optionImages").optString(index, ""))?.let { AsyncImage(it, "Imagem da alternativa ${index + 1}", modifier = Modifier.fillMaxWidth().heightIn(max = 140.dp)) } }
                if (isCorrect) Icon(Icons.Default.CheckCircle, "Resposta correta", tint = Color(0xFF168653))
                else if (selected) Icon(Icons.Default.Check, "Sua resposta")
            }
        }
        if (!revealed && !vm.roomTeacher) Text(when { !ready -> "Prepare-se. As alternativas liberam quando a rodada começa."; answered -> "Resposta enviada! Aguarde o resultado da rodada."; over -> "O tempo terminou. Aguarde o resultado."; !vm.connected -> "A resposta precisa de conexão. O aplicativo tenta reconectar automaticamente."; else -> "Escolha uma alternativa. Sua primeira resposta é a que vale." }, color = EduMuted)
        if (revealed && state.raw.str("explanation").isNotBlank()) InfoCard(state.raw.str("explanation"))
        if (revealed && !vm.roomTeacher) state.me?.let { Text("+${points(it.optInt("roundPoints"))} nesta rodada · ${points(it.optInt("score"))} no total", color = EduBlue, fontWeight = FontWeight.Bold) }
    } }
}
@Composable private fun PlayerRow(player: JSONObject, me: String?, showScore: Boolean = true, onRemove: (() -> Unit)? = null) {
    Surface(color = if (player.str("id") == me) Color(0xFFEAF0FF) else Color.White, shape = RoundedCornerShape(15.dp)) {
        Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            if (showScore) Text("${player.optInt("position")}º", fontWeight = FontWeight.Bold, color = EduMuted)
            Text(player.str("avatar"), fontSize = 27.sp)
            Column(Modifier.weight(1f)) { Text(player.str("name"), fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis); if (player.str("id") == me) Text("Você", style = MaterialTheme.typography.labelSmall, color = EduBlue) }
            if (showScore) Text(points(player.optInt("score")), fontWeight = FontWeight.ExtraBold, color = EduBlue)
            onRemove?.let { IconButton(onClick = it) { Icon(Icons.Default.PersonRemove, "Remover participante") } }
        }
    }
}
@Composable private fun Podium(players: List<JSONObject>) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
        players.take(2).forEachIndexed { index, player -> Surface(color = if (index == 0) EduNavy else Color(0xFFEAF0FF), shape = RoundedCornerShape(22.dp), modifier = Modifier.weight(1f)) {
            Column(Modifier.padding(18.dp).heightIn(min = if (index == 0) 220.dp else 185.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.Default.EmojiEvents, null, tint = if (index == 0) EduLime else EduBlue)
                Text(player.str("avatar"), fontSize = if (index == 0) 48.sp else 38.sp)
                Text("${index + 1}º lugar", color = if (index == 0) EduLime else EduBlue, fontWeight = FontWeight.Bold)
                Text(player.str("name"), color = if (index == 0) Color.White else EduNavy, fontWeight = FontWeight.Bold, maxLines = 2)
                Text("${points(player.optInt("score"))} pts", color = if (index == 0) Color.White else EduBlue)
            }
        } }
    }
}
