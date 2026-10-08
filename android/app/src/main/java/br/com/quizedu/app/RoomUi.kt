package br.com.quizedu.app

import android.graphics.Bitmap
import android.os.SystemClock
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.ImeAction
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
            if (vm.roomTeacher) TextButton(onClick = vm::leaveRoom) { Text("Voltar às minhas aulas") }
            else if (vm.roomError != null) TextButton(onClick = { vm.openRoom(vm.currentCode, false) }, enabled = !vm.busy) { Text("Tentar novamente") }
        }
        return
    }
    if (state.status == "closed" && vm.roomTeacher) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) { Heading("Esta sala foi encerrada.", "Peça ao professor o código da próxima aula."); Button(onClick = vm::leaveRoom) { Text("Entrar em outra sala") } }
        return
    }
    if (!vm.roomTeacher && state.me == null && state.status !in listOf("finished", "closed")) { JoinScreen(vm, state); return }
    if (!vm.roomTeacher) { StudentRoomScreen(vm, state); return }
    val context = LocalContext.current
    Column(Modifier.fillMaxSize()) {
    LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("room-content"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text(state.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis); Text("Sala ${state.code} · ${state.raw.str("teacher")}", color = EduMuted, fontSize = 13.sp) }
            if (!vm.roomTeacher) state.me?.let { PlayerAvatar(it.str("avatar"), 40.dp) }
        } }
        if (!vm.connected) item { InfoCard("Reconectando à sala. Sua participação e seus pontos foram preservados. As respostas precisam de conexão para serem enviadas.", true) }
        when (state.status) {
            "lobby" -> {
                if (vm.roomTeacher) item { LobbyInvite(state.code) }
                else item { Surface(color = EduNavy, shape = RoundedCornerShape(24.dp)) { Column(Modifier.fillMaxWidth().padding(25.dp), verticalArrangement = Arrangement.spacedBy(13.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    PlayerAvatar(state.me?.str("avatar") ?: avatarOptions.first().id, 88.dp)
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
    }
    if (vm.roomTeacher && state.status != "finished") TeacherControls(vm, state, onClose = { closeConfirm = true })
    if (state.status == "finished") Surface(shadowElevation = 8.dp) { Button(onClick = vm::leaveRoom, modifier = Modifier.fillMaxWidth().padding(18.dp).heightIn(min = 52.dp)) { Text(if (vm.roomTeacher) "Voltar às minhas aulas" else "Entrar em outra sala") } }
    }
    if (closeConfirm) AlertDialog(onDismissRequest = { closeConfirm = false }, title = { Text("Encerrar a sala?") }, text = { Text("Os alunos deixam de responder. O relatório da aula permanece disponível na conta do professor.") }, confirmButton = { TextButton(onClick = { closeConfirm = false; vm.control("close") }) { Text("Encerrar sala") } }, dismissButton = { TextButton(onClick = { closeConfirm = false }) { Text("Continuar aula") } })
}
@Composable private fun JoinScreen(vm: QuizViewModel, state: RoomSnapshot) {
    var name by rememberSaveable(state.code) { mutableStateOf(vm.repository.preferences.getString("student_name", "") ?: "") }
    var avatar by rememberSaveable(state.code) { mutableStateOf(avatarOption(vm.repository.preferences.getString("student_avatar", "") ?: "").id) }
    val keyboard = LocalSoftwareKeyboardController.current
    val context = LocalContext.current
    val canJoin = state.status == "lobby" || (state.presentation != null && state.status == "slide")
    Column(Modifier.fillMaxSize().imePadding()) {
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            item { Heading("Entrar na sala", state.title) }
            item { OutlinedTextField(name, { name = it.take(24) }, label = { Text("Como você quer aparecer?") }, singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Done), keyboardActions = KeyboardActions(onDone = { keyboard?.hide() }), modifier = Modifier.fillMaxWidth()) }
            item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Text("Escolha seu avatar", fontWeight = FontWeight.Bold); Text("Arraste para ver mais", color = EduMuted, fontSize = 12.sp) } }
            item { LazyRow(Modifier.fillMaxWidth().selectableGroup().testTag("avatar-carousel"), horizontalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(vertical = 4.dp)) {
                items(avatarOptions, key = { it.id }) { option ->
                    val selected = avatar == option.id
                    val shape = RoundedCornerShape(20.dp)
                    Surface(color = if (selected) Color(0xFFF0EDFF) else Color.White, shape = shape,
                        modifier = Modifier.width(94.dp).border(2.dp, if (selected) EduBlue else Color(0xFFDCE3EF), shape)
                            .selectable(selected = selected, role = Role.RadioButton, onClick = { avatar = option.id })
                            .semantics { contentDescription = "Avatar ${option.name}" }.testTag("avatar-${option.id}")) {
                        Column(Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Box { PlayerAvatar(option.id, 74.dp); if (selected) Icon(Icons.Default.CheckCircle, "Selecionado", tint = EduBlue, modifier = Modifier.align(Alignment.TopEnd).size(23.dp)) }
                            Text(option.name, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }
            } }
            item { Text("${avatarOption(avatar).name} selecionado", color = EduMuted, fontSize = 14.sp) }
            item { TextButton(onClick = { openWeb(context, "https://www.dicebear.com/styles/adventurer/") }, contentPadding = PaddingValues(0.dp)) { Text("Adventurer · Lisa Wischofsky / DiceBear · CC BY 4.0", fontSize = 12.sp) } }
            if (!canJoin) item { InfoCard("A turma está respondendo. Em uma apresentação, aguarde o professor passar para um slide de conteúdo para entrar.") }
        }
        Surface(color = Color.White, shadowElevation = 8.dp, modifier = Modifier.fillMaxWidth()) {
            Button(onClick = { keyboard?.hide(); vm.join(name.trim(), avatar) }, enabled = canJoin && !vm.busy && vm.connected && name.trim().length >= 2,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 14.dp).heightIn(min = 54.dp).testTag("student-join-action")) { Text("Entrar e participar", fontWeight = FontWeight.Bold) }
        }
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
        Text("No Android: abra o Prativerso e toque em “Ler QR code”. No navegador: leia o QR code ou digite o código da sala.", color = EduMuted)
        InfoCard("No computador, abra esta sala no Prativerso com a mesma conta. O celular passa a controlar a apresentação e o placar.")
    } }
}
@Composable private fun TeacherControls(vm: QuizViewModel, state: RoomSnapshot, onClose: () -> Unit) {
    val enabled = !vm.busy && vm.connected && state.isHost
    Surface(color = Color.White, shadowElevation = 8.dp, modifier = Modifier.fillMaxWidth().testTag("teacher-controls")) {
        Column(Modifier.padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (state.status == "lobby") {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("${state.players.size} participantes", color = EduMuted, fontSize = 14.sp); Text("Sala ${state.code}", color = EduBlue, fontWeight = FontWeight.Bold, fontSize = 14.sp) }
                Button(onClick = { vm.control("start") }, enabled = enabled && (state.players.isNotEmpty() || state.presentation != null), modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("teacher-primary-action")) { Icon(Icons.Default.PlayArrow, null); Spacer(Modifier.width(8.dp)); Text(if (state.presentation != null) "Iniciar apresentação" else "Iniciar quiz") }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (state.presentation != null) OutlinedButton(onClick = { vm.control("previous") }, enabled = enabled && (state.presentation!!.optInt("index") > 0 || state.presentation!!.optInt("step") > 0) && state.status != "question", modifier = Modifier.weight(1f).heightIn(min = 52.dp)) { Icon(Icons.Default.SkipPrevious, null); Text("Anterior") }
                    Button(onClick = { vm.control(if (state.status == "question") "end_round" else "next") }, enabled = enabled, modifier = Modifier.weight(1f).heightIn(min = 52.dp).testTag("teacher-primary-action")) { Text(if (state.status == "question") "Revelar resultado" else "Próximo"); Spacer(Modifier.width(5.dp)); Icon(Icons.Default.SkipNext, null) }
                }
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                if (state.presentation != null && state.status != "lobby") TextButton(onClick = { vm.control("blackout") }, enabled = enabled && state.status in listOf("slide", "results")) { Icon(if (state.presentation!!.optBoolean("blackout")) Icons.Default.Visibility else Icons.Default.VisibilityOff, null); Spacer(Modifier.width(6.dp)); Text(if (state.presentation!!.optBoolean("blackout")) "Mostrar telão" else "Pausar telão", fontSize = 13.sp) }
                TextButton(onClick = onClose, enabled = enabled) { Text("Encerrar sala", fontSize = 13.sp) }
            }
        }
    }
}
@Composable internal fun QuestionPanel(vm: QuizViewModel, state: RoomSnapshot, revealed: Boolean) {
    val question = state.question ?: return
    var elapsed by remember { mutableStateOf(SystemClock.elapsedRealtime()) }
    LaunchedEffect(state.status, state.startsAt, revealed) { while (!revealed) { elapsed = SystemClock.elapsedRealtime(); delay(100) } }
    val now = vm.serverTime(elapsed)
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
            val background = if (isCorrect) Color(0xFFE3F5E9) else if (selected) Color(0xFFF0EDFF) else Color.White
            OutlinedButton(onClick = { vm.answer(index) }, enabled = !vm.roomTeacher && !vm.busy && vm.connected && ready && !over && !answered && !revealed,
                colors = ButtonDefaults.outlinedButtonColors(containerColor = background, disabledContainerColor = background, disabledContentColor = EduNavy), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), contentPadding = PaddingValues(15.dp)) {
                Text(('A'.code + index).toChar().toString(), color = if (isCorrect) Color(0xFF168653) else EduBlue, fontWeight = FontWeight.Bold, modifier = Modifier.width(28.dp))
                Column(Modifier.weight(1f)) { Text(text); mediaUrl(question.arr("optionImages").optString(index, ""))?.let { AsyncImage(it, "Imagem da alternativa ${index + 1}", modifier = Modifier.fillMaxWidth().heightIn(max = 140.dp)) } }
                if (isCorrect) Icon(Icons.Default.CheckCircle, "Resposta correta", tint = Color(0xFF168653))
                else if (selected) Icon(Icons.Default.Check, "Sua resposta")
            }
        }
        if (!revealed && !vm.roomTeacher && (!ready || answered || over)) Text(when { !ready -> "Prepare-se."; answered -> "Resposta confirmada. Aguarde o resultado."; over -> "Tempo encerrado."; !vm.connected -> "Reconectando… Aguarde para responder."; else -> "" }, color = EduMuted)
        if (revealed && state.raw.str("explanation").isNotBlank()) InfoCard(state.raw.str("explanation"))
        if (revealed && !vm.roomTeacher) state.me?.let { Text("+${points(it.optInt("roundPoints"))} nesta rodada · ${points(it.optInt("score"))} no total", color = EduBlue, fontWeight = FontWeight.Bold) }
    } }
}
@Composable private fun PlayerRow(player: JSONObject, me: String?, showScore: Boolean = true, onRemove: (() -> Unit)? = null) {
    Surface(color = if (player.str("id") == me) Color(0xFFF0EDFF) else Color.White, shape = RoundedCornerShape(15.dp)) {
        Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            if (showScore) Text("${player.optInt("position")}º", fontWeight = FontWeight.Bold, color = EduMuted)
            PlayerAvatar(player.str("avatar"), 38.dp)
            Column(Modifier.weight(1f)) { Text(player.str("name"), fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis); if (player.str("id") == me) Text("Você", style = MaterialTheme.typography.labelSmall, color = EduBlue) }
            if (showScore) Text(points(player.optInt("score")), fontWeight = FontWeight.ExtraBold, color = EduBlue)
            onRemove?.let { IconButton(onClick = it) { Icon(Icons.Default.PersonRemove, "Remover participante") } }
        }
    }
}
@Composable internal fun Podium(players: List<JSONObject>) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
        players.take(2).forEachIndexed { index, player -> Surface(color = if (index == 0) EduNavy else Color(0xFFF0EDFF), shape = RoundedCornerShape(22.dp), modifier = Modifier.weight(1f)) {
            Column(Modifier.padding(18.dp).heightIn(min = if (index == 0) 220.dp else 185.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.Default.EmojiEvents, null, tint = if (index == 0) EduLime else EduBlue)
                PlayerAvatar(player.str("avatar"), if (index == 0) 78.dp else 64.dp)
                Text("${index + 1}º lugar", color = if (index == 0) EduLime else EduBlue, fontWeight = FontWeight.Bold)
                Text(player.str("name"), color = if (index == 0) Color.White else EduNavy, fontWeight = FontWeight.Bold, maxLines = 2)
                Text("${points(player.optInt("score"))} pts", color = if (index == 0) Color.White else EduBlue)
            }
        } }
    }
}
