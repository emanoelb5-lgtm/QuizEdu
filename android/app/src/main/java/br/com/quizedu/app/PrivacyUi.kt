package br.com.quizedu.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

@Composable fun PrivacyLinks() {
    val context = LocalContext.current
    Row(Modifier.fillMaxWidth()) {
        TextButton(onClick = { openWeb(context, "/privacidade") }) { Text("Privacidade e termos") }
        TextButton(onClick = { openWeb(context, "/contato") }) { Text("Contato e ajuda") }
    }
}
@Composable fun DeleteAccountDialog(vm: QuizViewModel, onDismiss: () -> Unit) {
    var confirmation by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = { if (!vm.busy) onDismiss() }, title = { Text("Excluir conta e dados?") }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Seu perfil no Prativerso, aulas, imagens, quizzes, salas e registros associados serão apagados. Aparelhos vinculados perderão acesso. Essa ação é definitiva e não exclui sua conta ChatGPT.")
            Text("As cópias exportadas ou guardadas em outros aparelhos precisam ser apagadas nesses locais.")
            OutlinedTextField(confirmation, { confirmation = it }, label = { Text("Digite EXCLUIR") }, singleLine = true, modifier = Modifier.testTag("delete-account-confirmation"))
        }
    }, confirmButton = { TextButton(onClick = { vm.deleteAccount(confirmation); onDismiss() }, enabled = confirmation == "EXCLUIR" && !vm.busy) { Text("Excluir definitivamente") } }, dismissButton = { TextButton(onClick = onDismiss, enabled = !vm.busy) { Text("Cancelar") } })
}
@Composable fun StudentSafetyActions(vm: QuizViewModel) {
    var reporting by remember { mutableStateOf(false) }; var deleting by remember { mutableStateOf(false) }; var message by remember { mutableStateOf("") }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        TextButton(onClick = { reporting = true }, enabled = !vm.busy, modifier = Modifier.testTag("report-classroom")) { Text("Avisar professor") }
        TextButton(onClick = { deleting = true }, enabled = !vm.busy) { Text("Excluir meus dados") }
    }
    if (reporting) AlertDialog(onDismissRequest = { reporting = false }, title = { Text("Avisar professor") }, text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Descreva um conteúdo ou comportamento inadequado. O aviso é privado para o professor da sala. Não inclua dados pessoais de colegas.")
        OutlinedTextField(message, { message = it.take(300) }, label = { Text("O que aconteceu?") }, minLines = 3)
    } }, confirmButton = { TextButton(onClick = { vm.reportClassroom(message); reporting = false; message = "" }, enabled = message.trim().length >= 3 && !vm.busy) { Text("Enviar aviso") } }, dismissButton = { TextButton(onClick = { reporting = false }) { Text("Cancelar") } })
    if (deleting) AlertDialog(onDismissRequest = { deleting = false }, title = { Text("Excluir minha participação?") }, text = { Text("Seu nome, respostas, votos, palavras e pontuação desta sala serão apagados. Essa ação é definitiva. Ela não apaga os dados dos colegas.") }, confirmButton = { TextButton(onClick = { deleting = false; vm.deleteParticipation() }, enabled = !vm.busy) { Text("Excluir definitivamente") } }, dismissButton = { TextButton(onClick = { deleting = false }) { Text("Cancelar") } })
}
@Composable fun ModerationPanel(vm: QuizViewModel, state: RoomSnapshot) {
    var expanded by remember { mutableStateOf(false) }; var removeId by remember { mutableStateOf<String?>(null) }
    OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        TextButton(onClick = { expanded = !expanded }, modifier = Modifier.testTag("moderation-panel")) { Text("Moderar sala · ${state.raw.arr("reports").length()} avisos") }
        if (expanded) {
            state.raw.arr("reports").objects().forEach { r -> Text("${r.str("name")}: ${r.str("message")}"); TextButton(onClick = { vm.moderate("resolve_report", r.str("id")) }, enabled = !vm.busy) { Text("Marcar como resolvido") } }
            state.wordCloud?.arr("words")?.objects()?.forEach { w -> Row { Text(w.str("word"), Modifier.weight(1f)); TextButton(onClick = { vm.moderate("hide_word", w.str("id")) }, enabled = !vm.busy) { Text("Ocultar") } } }
            state.players.forEach { p -> Row { Text(p.str("name"), Modifier.weight(1f)); TextButton(onClick = { removeId = p.str("id") }, enabled = !vm.busy) { Text("Remover") } } }
        }
    } }
    removeId?.let { id -> AlertDialog(onDismissRequest = { removeId = null }, title = { Text("Remover participante?") }, text = { Text("Este aparelho não poderá continuar participando nesta sala. As palavras enviadas serão ocultadas.") }, confirmButton = { TextButton(onClick = { removeId = null; vm.control("kick", playerId = id) }) { Text("Remover") } }, dismissButton = { TextButton(onClick = { removeId = null }) { Text("Cancelar") } }) }
}
