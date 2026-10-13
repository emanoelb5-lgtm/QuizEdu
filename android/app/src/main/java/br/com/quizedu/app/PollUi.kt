package br.com.quizedu.app

import android.os.SystemClock
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.ceil

@Composable internal fun PollSlidePreview(question: JSONObject, results: JSONObject?, scale: Float, textScale: Float, ink: Color) {
    val options = question.arr("options").strings()
    val cols = if (options.size > 4) 4 else 2
    val percentage = NumberFormat.getNumberInstance(Locale.forLanguageTag("pt-BR")).apply { maximumFractionDigits = 1 }
    Column(Modifier.fillMaxSize().padding((30 * scale).dp), verticalArrangement = Arrangement.spacedBy((14 * scale).dp)) {
        Text("ENQUETE · ${if (results?.optBoolean("revealed") == true) "RESULTADOS DA TURMA" else if (question.optBoolean("allowMultiple")) "VÁRIAS ESCOLHAS" else "UMA ESCOLHA"}", fontSize = (18 * textScale).sp, fontWeight = FontWeight.Bold, color = EduBlue)
        Row(horizontalArrangement = Arrangement.spacedBy((18 * scale).dp)) {
            Text(question.str("text").ifBlank { "Escreva a pergunta da enquete" }, modifier = Modifier.weight(1f), fontSize = (32 * textScale).sp, lineHeight = (37 * textScale).sp, fontWeight = FontWeight.Bold, color = ink, maxLines = 3)
            mediaUrl(question.str("image"))?.let { AsyncImage(it, question.str("imageAlt", "Imagem da enquete"), modifier = Modifier.size((130 * scale).dp, (90 * scale).dp)) }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy((12 * scale).dp)) {
            options.chunked(cols).forEachIndexed { row, labels -> Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy((12 * scale).dp)) {
                labels.forEachIndexed { col, label ->
                    val index = row * cols + col
                    Surface(color = Color(0xFFF0EDFF), shape = RoundedCornerShape((10 * scale).dp), modifier = Modifier.weight(1f).fillMaxHeight()) {
                        Column(Modifier.padding((12 * scale).dp), verticalArrangement = Arrangement.spacedBy((6 * scale).dp)) {
                            Text("${('A'.code + index).toChar()}  $label", fontWeight = FontWeight.Bold, fontSize = ((if (cols == 4) 16 else 22) * textScale).sp, lineHeight = ((if (cols == 4) 19 else 26) * textScale).sp, maxLines = 3, color = EduNavy)
                            mediaUrl(question.arr("optionImages").optString(index))?.let { AsyncImage(it, label.ifBlank { "Foto da opção ${index + 1}" }, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxWidth().weight(1f)) }
                            if (results?.optBoolean("revealed") == true) {
                                Spacer(Modifier.weight(.001f))
                                Text("${results.arr("counts").optInt(index)} alunos · ${percentage.format(results.arr("percentages").optDouble(index, 0.0))}%", fontSize = (16 * textScale).sp, color = EduBlue, fontWeight = FontWeight.Bold)
                                LinearProgressIndicator(progress = { (results.arr("percentages").optDouble(index, 0.0) / 100).toFloat().coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth().height((8 * scale).dp))
                            }
                        }
                    }
                }
                repeat(cols - labels.size) { Spacer(Modifier.weight(1f)) }
            } }
        }
        Text(if (results?.optBoolean("revealed") == true) "${results.optInt("respondents")} alunos responderam. Porcentagens entre quem votou.${if (question.optBoolean("allowMultiple")) " A soma pode passar de 100%." else ""}" else "Responda pelo celular. As contagens aparecem após a revelação.", color = ink, fontSize = (13 * textScale).sp, maxLines = 2)
    }
}

private fun JSONArray.indicesList(): List<Int> = (0 until length()).map { optInt(it, -1) }

@Composable internal fun PollPanel(vm: QuizViewModel, state: RoomSnapshot) {
    val question = state.question ?: return
    val poll = state.poll ?: return
    val mine = poll.arr("myChoices").indicesList()
    val confirmed = mine.isNotEmpty()
    val closed = state.status != "question"
    val pending = vm.pollPending?.takeIf { it.str("room") == state.code && it.str("player") == state.me?.str("id") && it.optInt("index", -1) == state.index }
    var choices by rememberSaveable(state.code, state.index, state.me?.str("id")) { mutableStateOf(listOf<Int>()) }
    var elapsed by remember { mutableStateOf(SystemClock.elapsedRealtime()) }
    LaunchedEffect(state.startsAt, closed) { while (!closed) { elapsed = SystemClock.elapsedRealtime(); delay(100) } }
    val countdown = ceil((state.startsAt - vm.serverTime(elapsed)).coerceAtLeast(0) / 1000.0).toInt()
    LaunchedEffect(pending?.toString(), confirmed, closed) {
        while (pending != null && !confirmed && !closed) { delay(2000); if (vm.connected && !vm.busy) vm.votePoll(pending.arr("choices").indicesList()) }
    }
    val picked = if (confirmed) mine else pending?.arr("choices")?.indicesList() ?: choices
    val canChoose = !vm.roomTeacher && !vm.busy && vm.connected && countdown == 0 && !closed && !confirmed && pending == null
    val percentage = NumberFormat.getNumberInstance(Locale.forLanguageTag("pt-BR")).apply { maximumFractionDigits = 1 }
    OutlinedCard(Modifier.fillMaxWidth().testTag("poll-panel")) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("ENQUETE", color = EduBlue, fontWeight = FontWeight.Bold)
        Text(question.str("text"), fontSize = 23.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold)
        Text(if (question.optBoolean("allowMultiple")) "Marque uma ou mais opções e confirme seu voto." else "Escolha uma opção e confirme seu voto.", color = EduMuted)
        if (!closed && countdown > 0) Text("Começa em $countdown…", color = EduBlue)
        mediaUrl(question.str("image"))?.let { AsyncImage(it, question.str("imageAlt", "Imagem da enquete"), modifier = Modifier.fillMaxWidth().heightIn(max = 200.dp)) }
        question.arr("options").strings().forEachIndexed { index, label ->
            val chosen = index in picked
            OutlinedButton(onClick = { choices = if (!question.optBoolean("allowMultiple")) listOf(index) else if (index in choices) choices - index else choices + index },
                enabled = canChoose, modifier = Modifier.fillMaxWidth().testTag("poll-option-$index").semantics { selected = chosen },
                shape = RoundedCornerShape(14.dp), contentPadding = PaddingValues(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = if (chosen) Color(0xFFF0EDFF) else Color.White, disabledContainerColor = if (chosen) Color(0xFFF0EDFF) else Color.White, disabledContentColor = EduNavy)) {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(('A'.code + index).toChar().toString(), color = EduBlue, fontWeight = FontWeight.Bold, modifier = Modifier.width(28.dp))
                        Text(label.ifBlank { "Foto da opção ${('A'.code + index).toChar()}" }, modifier = Modifier.weight(1f))
                        if (!vm.roomTeacher && !poll.optBoolean("revealed")) {
                            if (question.optBoolean("allowMultiple")) Checkbox(chosen, onCheckedChange = null)
                            else RadioButton(chosen, onClick = null)
                        }
                    }
                    mediaUrl(question.arr("optionImages").optString(index))?.let { AsyncImage(it, label.ifBlank { "Foto da opção ${index + 1}" }, modifier = Modifier.fillMaxWidth().height(145.dp)) }
                    if (poll.optBoolean("revealed")) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            val count = poll.arr("counts").optInt(index)
                            Text("$count ${if (count == 1) "aluno" else "alunos"}")
                            Text("${percentage.format(poll.arr("percentages").optDouble(index, 0.0))}%", fontWeight = FontWeight.Bold, color = EduBlue, modifier = Modifier.testTag("poll-percent-$index"))
                        }
                        LinearProgressIndicator(progress = { (poll.arr("percentages").optDouble(index, 0.0) / 100).toFloat().coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        }
        if (!vm.roomTeacher) {
            if (confirmed) Text("Voto confirmado!${if (!poll.optBoolean("revealed")) " Aguarde a revelação dos resultados." else ""}", fontWeight = FontWeight.Bold, color = EduBlue, modifier = Modifier.testTag("poll-confirmed"))
            else if (!closed) Button(onClick = { vm.votePoll(picked) }, enabled = picked.isNotEmpty() && !vm.busy && vm.connected && countdown == 0, modifier = Modifier.fillMaxWidth().testTag("poll-confirm")) { Text(if (pending != null) "Tentar confirmar novamente" else "Confirmar voto") }
            else Text("Você não enviou um voto nesta enquete.", color = EduMuted)
            if (!confirmed) vm.pollNotice?.let { Text(it, color = EduMuted) }
        }
        Text("${poll.optInt("respondents")} alunos responderam", color = EduMuted)
        if (poll.optBoolean("revealed")) {
            Text(if (question.optBoolean("allowMultiple")) "Cada porcentagem considera os alunos que responderam. A soma pode passar de 100%." else "Porcentagens entre os alunos que responderam.", color = EduMuted, fontSize = 13.sp)
            if (state.raw.str("explanation").isNotBlank()) InfoCard(state.raw.str("explanation"))
        } else Text("As contagens aparecem após o professor revelar os resultados.", color = EduMuted, fontSize = 13.sp)
    } }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable internal fun PollInspector(vm: QuizViewModel, question: JSONObject, onImage: (Int?) -> Unit) {
    fun update(change: (JSONObject) -> Unit) { vm.changeSlide { change(it.getJSONObject("question")) } }
    Text("Enquete para a turma", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
    OutlinedTextField(question.str("text"), { value -> update { it.put("text", value.take(400)) } }, label = { Text("Pergunta da enquete") }, minLines = 2, modifier = Modifier.fillMaxWidth().testTag("poll-prompt"), enabled = !vm.busy)
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Switch(question.optBoolean("allowMultiple"), { value -> update { it.put("allowMultiple", value) } }, enabled = !vm.busy, modifier = Modifier.testTag("poll-multiple"))
        Spacer(Modifier.width(10.dp)); Text(if (question.optBoolean("allowMultiple")) "Permitir várias escolhas" else "Uma escolha por aluno")
    }
    question.arr("options").strings().forEachIndexed { index, text ->
        OutlinedTextField(text, { value -> update { it.arr("options").put(index, value.take(180)) } }, label = { Text("Opção ${('A'.code + index).toChar()} · texto opcional com foto") }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth())
        mediaUrl(question.arr("optionImages").optString(index))?.let { AsyncImage(it, text.ifBlank { "Foto da opção ${index + 1}" }, modifier = Modifier.fillMaxWidth().height(120.dp)) }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { onImage(index) }, enabled = !vm.busy) { Text(if (question.arr("optionImages").optString(index).isBlank()) "Adicionar foto" else "Trocar foto") }
            if (question.arr("optionImages").optString(index).isNotBlank()) TextButton(onClick = { update { it.arr("optionImages").put(index, "") } }, enabled = !vm.busy) { Text("Remover foto") }
            if (question.arr("options").length() > 2) TextButton(onClick = { update { it.arr("options").remove(index); it.optJSONArray("optionImages")?.remove(index) } }, enabled = !vm.busy) { Text("Excluir opção") }
        }
    }
    OutlinedButton(onClick = { update { it.arr("options").put(""); it.optJSONArray("optionImages")?.put("") } }, enabled = !vm.busy && question.arr("options").length() < 8, modifier = Modifier.testTag("poll-add-option")) { Text("Adicionar opção (${question.arr("options").length()}/8)") }
    OutlinedButton(onClick = { onImage(null) }, enabled = !vm.busy) { Text(if (question.str("image").isBlank()) "Adicionar imagem do enunciado" else "Trocar imagem do enunciado") }
    if (question.str("image").isNotBlank()) {
        OutlinedTextField(question.str("imageAlt"), { value -> update { it.put("imageAlt", value.take(180)) } }, label = { Text("Descrição da imagem") }, modifier = Modifier.fillMaxWidth(), enabled = !vm.busy)
        TextButton(onClick = { update { it.remove("image"); it.remove("imageAlt") } }, enabled = !vm.busy) { Text("Remover imagem do enunciado") }
    }
    OutlinedTextField(question.str("explanation"), { value -> update { it.put("explanation", value.take(500)) } }, label = { Text("Comentário após a revelação") }, modifier = Modifier.fillMaxWidth(), enabled = !vm.busy, minLines = 2)
    Text("Opiniões sem gabarito e sem alterar os pontos. A votação fica aberta até todos responderem ou você revelar os resultados.", color = EduMuted)
}
