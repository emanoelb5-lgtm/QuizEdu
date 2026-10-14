package br.com.quizedu.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

@Composable fun StudentRoomScreen(vm: QuizViewModel, state: RoomSnapshot) {
    Column(Modifier.fillMaxSize().imePadding()) {
        StudentOverview(state)
        if (!vm.connected) Text("Reconectando… Aguarde para responder.", color = EduMuted, fontSize = 14.sp, modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp))
        LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("student-room-content"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item { StudentSafetyActions(vm) }
            when (state.status) {
                "lobby" -> item {
                    Column(Modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Você está na sala!", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text(if (state.presentation != null) "Aguardando o início da apresentação." else "Aguardando o início do quiz.", color = EduMuted)
                    }
                }
                "slide" -> {
                    val presentation = state.presentation
                    val slide = presentation?.optJSONObject("slide")
                    if (presentation != null) item { Text("Slide ${presentation.optInt("index") + 1} de ${presentation.optInt("total")}${if (presentation.optBoolean("review")) " · Revisão" else ""}", color = EduMuted, fontSize = 14.sp) }
                    if (state.wordCloud != null) item { WordCloudPanel(vm, state) }
                    else if (presentation?.optBoolean("blackout") == true) item {
                        Surface(color = Color.Black, modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f)) { Box(contentAlignment = Alignment.Center) { Text("Aguarde o professor continuar.", color = Color.White) } }
                    } else if (slide != null) item { SlideView(slide, Modifier.fillMaxWidth(), step = presentation.optInt("step"), pollResults = state.poll) }
                    if (state.question != null && presentation?.optBoolean("review") == true) item { StudentRoundResult(vm, state, review = true) }
                }
                "question" -> item { QuestionPanel(vm, state, revealed = false) }
                "wordcloud" -> item { WordCloudPanel(vm, state) }
                "results" -> item { StudentRoundResult(vm, state) }
                "finished" -> {
                    item { Text(if (state.presentation != null) "Aula concluída" else "Quiz concluído", fontWeight = FontWeight.Bold, fontSize = 22.sp) }
                    if (state.gradingTotal > 0) {
                        state.me?.let { me -> item { Text("${me.optInt("correctCount")} acertos de ${state.gradingTotal} perguntas", color = EduMuted) } }
                    }
                    if (state.players.isNotEmpty() && (state.gradingTotal > 0 || state.players.any { it.optInt("score") > 0 })) item { Podium(state.players) }
                }
                "closed" -> item { Text("Sala encerrada. Obrigado por participar.", color = EduMuted) }
            }
        }
        StudentRankingDock(state)
    }
}

@Composable private fun StudentOverview(state: RoomSnapshot) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(state.title, fontSize = 18.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
        state.me?.let { me ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PlayerAvatar(me.str("avatar"), 32.dp)
                Text(me.str("name"), fontSize = 16.sp, color = EduMuted, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Column(horizontalAlignment = Alignment.End) {
                    Text("${points(me.optInt("score"))} pontos", fontWeight = FontWeight.Bold, color = EduBlue, fontSize = 18.sp, modifier = Modifier.testTag("student-current-score"))
                    if (state.status != "lobby" && me.optInt("position") > 0) Text("${me.optInt("position")}º lugar", fontSize = 13.sp, color = EduMuted)
                }
            }
        }
    }
}

@Composable private fun StudentRankingDock(state: RoomSnapshot) {
    Surface(shadowElevation = 8.dp, color = Color.White, modifier = Modifier.fillMaxWidth().testTag("student-ranking")) {
        Column(Modifier.padding(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Ranking ao vivo", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = EduBlue)
                Text("${state.players.size} participantes · Arraste", fontSize = 12.sp, color = EduMuted)
            }
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(horizontal = 14.dp)) {
                items(state.players, key = { it.str("id") }) { player ->
                    Surface(color = if (player.str("id") == state.me?.str("id")) Color(0xFFF0EDFF) else Color(0xFFF8F7FC), shape = MaterialTheme.shapes.small) {
                        Row(Modifier.width(175.dp).padding(9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            Text("#${player.optInt("position")}", fontWeight = FontWeight.Bold, color = EduBlue, fontSize = 13.sp)
                            PlayerAvatar(player.str("avatar"), 27.dp)
                            Column(Modifier.weight(1f)) {
                                Text(player.str("name"), fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("${points(player.optInt("score"))} pts", fontSize = 12.sp, color = EduMuted)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun StudentRoundResult(vm: QuizViewModel, state: RoomSnapshot, review: Boolean = false) {
    val question = state.question ?: return
    if (state.poll != null) { PollPanel(vm, state); return }
    val me = state.me
    val correct = state.correct
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (!review) {
            Text(if (me?.optBoolean("roundCorrect") == true) "Resposta certa!" else if (me?.optBoolean("answered") == true) "Valeu a tentativa!" else "Sem resposta nesta rodada", fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text("+${points(me?.optInt("roundPoints") ?: 0)} pontos nesta rodada", color = EduBlue, fontWeight = FontWeight.Bold)
        }
        if (correct != null) {
            Text("RESPOSTA CORRETA", color = EduMuted, fontSize = 13.sp)
            Text(question.arr("options").optString(correct), fontSize = 20.sp, fontWeight = FontWeight.Bold)
            mediaUrl(question.arr("optionImages").optString(correct))?.let { AsyncImage(it, "Imagem da resposta correta", modifier = Modifier.fillMaxWidth().heightIn(max = 220.dp)) }
        }
        if (state.raw.str("explanation").isNotBlank()) Text(state.raw.str("explanation"), fontSize = 16.sp)
        if (!review) Text("Aguardando a próxima pergunta.", color = EduMuted, fontSize = 14.sp)
    }
}
