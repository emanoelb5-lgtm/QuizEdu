@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package br.com.quizedu.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import org.json.JSONObject

val EduBlue = Color(0xFF3155ED)
val EduNavy = Color(0xFF111C35)
val EduLime = Color(0xFFD2FB66)
val EduMuted = Color(0xFF61708A)
@Composable fun QuizEduTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = lightColorScheme(primary = EduBlue, onPrimary = Color.White, secondary = EduNavy, tertiary = EduLime,
        background = Color(0xFFF4F6FC), surface = Color.White, onSurface = Color(0xFF15203D), outline = Color(0xFFD5DFF1), surfaceVariant = Color(0xFFEAF0FF)),
        shapes = Shapes(small = RoundedCornerShape(12.dp), medium = RoundedCornerShape(18.dp), large = RoundedCornerShape(24.dp)), content = content)
}
fun openWeb(context: Context, path: String) {
    val url = if (path.startsWith("/")) BuildConfig.SITE_URL + path else path
    try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) { }
}
@Composable fun QuizEduApp(vm: QuizViewModel) {
    if (vm.pendingImport != null) PresentationImportPreview(vm)
    val snack = remember { SnackbarHostState() }
    val lifecycle = LocalLifecycleOwner.current
    var exitConfirm by remember { mutableStateOf(false) }
    LaunchedEffect(vm.message) { vm.message?.let { snack.showSnackbar(it, withDismissAction = true); vm.clearMessage() } }
    LaunchedEffect(vm.currentCode, vm.screen, vm.roomTeacher, lifecycle) {
        if (vm.screen != AppScreen.Room) return@LaunchedEffect
        lifecycle.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            vm.observeRoom()
        }
    }
    LaunchedEffect(vm.pendingPair, lifecycle) {
        if (vm.pendingPair.isBlank()) return@LaunchedEffect
        lifecycle.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { while (isActive && vm.pendingPair.isNotBlank()) { vm.pollPairing(); delay(2500) } }
    }
    BackHandler(enabled = vm.screen != AppScreen.Home) {
        if (!vm.busy) when (vm.screen) { AppScreen.Room -> exitConfirm = true; AppScreen.Editor -> vm.closeEditor(); else -> vm.home() }
    }
    Scaffold(snackbarHost = { SnackbarHost(snack) }, topBar = {
        Column {
            TopAppBar(title = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                Surface(color = EduBlue, shape = RoundedCornerShape(10.dp)) { Icon(Icons.Default.HelpOutline, "", tint = EduLime, modifier = Modifier.padding(7.dp).size(24.dp)) }
                Text("Quiz", fontWeight = FontWeight.ExtraBold, color = EduNavy); Text("Edu", fontWeight = FontWeight.Bold, color = EduBlue, modifier = Modifier.offset(x = (-8).dp))
            } }, navigationIcon = { if (vm.screen != AppScreen.Home && !(vm.screen == AppScreen.Room && !vm.roomTeacher)) IconButton(onClick = { if (vm.screen == AppScreen.Room) exitConfirm = true else if (vm.screen == AppScreen.Editor) vm.closeEditor() else vm.home() }, enabled = !vm.busy) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar") } },
                actions = { if (vm.screen == AppScreen.Room && !vm.roomTeacher) TextButton(onClick = { exitConfirm = true }, enabled = !vm.busy, modifier = Modifier.testTag("student-exit")) { Icon(Icons.Default.Logout, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(5.dp)); Text("Sair") }; if (vm.screen == AppScreen.Home) TextButton(onClick = { vm.mode(!vm.teacher) }, enabled = !vm.busy) { Text(if (vm.teacher) "Sou aluno" else "Sou professor") } })
            if (vm.busy) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }
    }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
            when (vm.screen) {
                AppScreen.Home -> if (vm.teacher) TeacherHome(vm) else StudentHome(vm)
                AppScreen.Editor -> EditorScreen(vm)
                AppScreen.Room -> RoomScreen(vm)
                AppScreen.Devices -> DevicesScreen(vm)
            }
        }
    }
    if (exitConfirm) AlertDialog(onDismissRequest = { exitConfirm = false }, title = { Text(if (vm.roomTeacher) "Voltar às minhas aulas?" else "Sair desta sala?") },
        text = { Text(if (vm.roomTeacher) "A sala continua aberta e pode ser retomada na lista de salas." else "Sua participação e os pontos permanecem na sala. Para retomar, entre novamente com este aparelho.") },
        confirmButton = { TextButton(onClick = { exitConfirm = false; vm.leaveRoom() }) { Text(if (vm.roomTeacher) "Sair da tela" else "Sair da sala") } }, dismissButton = { TextButton(onClick = { exitConfirm = false }) { Text(if (vm.roomTeacher) "Continuar aqui" else "Continuar na sala") } })
}
@Composable fun InfoCard(text: String, warning: Boolean = false) {
    Surface(color = if (warning) Color(0xFFFFF4DD) else Color(0xFFEAF0FF), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(15.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(if (warning) Icons.Default.WifiOff else Icons.Default.Info, null, tint = if (warning) Color(0xFF9A6A1A) else EduBlue)
            Text(text, style = MaterialTheme.typography.bodyMedium, color = EduNavy, modifier = Modifier.weight(1f))
        }
    }
}
@Composable fun Heading(title: String, description: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text(title, fontSize = 30.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 35.sp)
        description?.let { Text(it, color = EduMuted, style = MaterialTheme.typography.bodyLarge) }
    }
}
@Composable fun StudentHome(vm: QuizViewModel) {
    var code by rememberSaveable { mutableStateOf("") }
    val scanner = rememberLauncherForActivityResult(ScanContract()) { result -> result.contents?.let(vm::acceptLink) }
    Column(Modifier.fillMaxSize().imePadding()) {
    LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        item { Surface(color = EduNavy, shape = RoundedCornerShape(28.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(26.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text("QUIZEDU NO CELULAR", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = EduLime, letterSpacing = 1.2.sp)
                Text("Entre na sala", color = Color.White, fontSize = 28.sp, lineHeight = 34.sp, fontWeight = FontWeight.ExtraBold)
                Text("Entre na sala, escolha seu avatar e participe da aula.", color = Color(0xFFCDD7EF), lineHeight = 23.sp)
            }
        } }
        item { Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Qual é o código da sala?", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            OutlinedTextField(value = code, onValueChange = { code = it.filter(Char::isDigit).take(6) }, singleLine = true,
                label = { Text("Código de 6 números") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth(), textStyle = MaterialTheme.typography.headlineMedium)
        } }
        val previous = vm.repository.preferences.getString("student_room", "") ?: ""
        if (previous.matches(Regex("[0-9]{6}"))) item { OutlinedCard(onClick = { vm.openRoom(previous, false) }) {
            Row(Modifier.padding(18.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Restore, null, tint = EduBlue); Spacer(Modifier.width(12.dp)); Column { Text("Retomar minha sala", fontWeight = FontWeight.Bold); Text("Código $previous", color = EduMuted) } }
        } }
    }
    Surface(color = Color.White, shadowElevation = 8.dp, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(horizontal = 22.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { vm.acceptLink(code) }, enabled = code.length == 6, modifier = Modifier.fillMaxWidth().height(54.dp)) { Text("Entrar na sala", fontWeight = FontWeight.Bold) }
            OutlinedButton(onClick = { scanner.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Leia o QR code da sala QuizEdu").setBeepEnabled(false).setOrientationLocked(false)) }, modifier = Modifier.fillMaxWidth().height(54.dp)) {
                Icon(Icons.Default.QrCodeScanner, null); Spacer(Modifier.width(10.dp)); Text("Ler QR code")
            }
        }
    }
    }
}
@Composable fun TeacherHome(vm: QuizViewModel) {
    val context = LocalContext.current
    var name by rememberSaveable { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf<JSONObject?>(null) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { Heading(if (vm.profile == null) "A aula começa\ncom uma boa ideia." else "Olá, ${vm.profile?.str("name")?.substringBefore(" ") ?: "educador"}.",
            if (vm.profile == null) "Crie slides, misture perguntas e conduza sua aula pelo celular." else "Suas aulas e o controle da turma, sempre à mão.") }
        if (vm.pendingPair.isNotBlank()) item { ElevatedCard {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                Text("Autorize este Android", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Abra o navegador, entre na conta usada no computador e toque em “Vincular este Android”. Depois volte aqui.", color = EduMuted)
                Button(onClick = { openWeb(context, "/vincular-app?id=${vm.pendingPair}") }, modifier = Modifier.fillMaxWidth()) { Text("Abrir autorização no navegador") }
                TextButton(onClick = vm::cancelPairing) { Text("Cancelar vínculo") }
            }
        } }
        if (vm.profile == null) {
            item { Button(onClick = vm::startPairing, enabled = !vm.busy && vm.pendingPair.isBlank(), modifier = Modifier.fillMaxWidth().height(54.dp)) { Icon(Icons.Default.Devices, null); Spacer(Modifier.width(10.dp)); Text("Vincular minha conta") } }
            item { InfoCard("A conta é a mesma do QuizEdu no computador. Os alunos entram sem cadastro. Nenhuma assinatura Pro é necessária.") }
            item { OutlinedCard { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                Text("Quero experimentar agora", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Crie um acesso temporário, válido por 30 dias. Depois vincule a conta para guardar suas aulas.", color = EduMuted)
                OutlinedTextField(value = name, onValueChange = { name = it.take(30) }, label = { Text("Seu nome") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedButton(onClick = { vm.temporary(name.trim()) }, enabled = name.trim().length >= 2 && !vm.busy, modifier = Modifier.fillMaxWidth()) { Text("Criar acesso temporário") }
            } } }
        } else {
            item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = vm::newLesson, enabled = !vm.busy, modifier = Modifier.weight(1f).height(52.dp)) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(7.dp)); Text("Nova aula") }
                IconButton(onClick = vm::refreshLibrary, enabled = !vm.busy) { Icon(Icons.Default.Refresh, "Atualizar aulas") }
                Box { IconButton(onClick = { expanded = true }) { Icon(Icons.Default.MoreVert, "Opções da conta") }
                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        DropdownMenuItem(text = { Text("Vincular ou trocar conta") }, onClick = { expanded = false; vm.startPairing() })
                        DropdownMenuItem(text = { Text("Aparelhos vinculados") }, onClick = { expanded = false; vm.showDevices() })
                        DropdownMenuItem(text = { Text("Abrir QuizEdu no navegador") }, onClick = { expanded = false; openWeb(context, "/aulas") })
                        DropdownMenuItem(text = { Text("Sair desta conta") }, onClick = { expanded = false; vm.signOut() })
                    }
                }
            } }
            item { ImportPresentationButton(vm, Modifier.fillMaxWidth()) }
            if (vm.libraryOffline) item { InfoCard("Modo offline: edite os rascunhos e salve na conta quando a conexão voltar. As salas ao vivo precisam de internet.", true) }
            if (vm.profile?.optBoolean("permanent") != true) item { TextButton(onClick = vm::startPairing) { Icon(Icons.Default.CloudDone, null); Spacer(Modifier.width(8.dp)); Text("Vincular para guardar minhas aulas") } }
            if (vm.activeRooms.isNotEmpty()) {
                item { Text("Salas em andamento", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium) }
                items(vm.activeRooms, key = { "room-${it.str("code")}" }) { room -> OutlinedCard(onClick = { vm.openRoom(room.str("code"), true) }) {
                    Row(Modifier.padding(16.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(Icons.Default.PresentToAll, null, tint = EduBlue)
                        Column(Modifier.weight(1f)) { Text(room.str("title"), fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis); Text("Sala ${room.str("code")} · ${room.optInt("player_count")} participantes", color = EduMuted, fontSize = 13.sp) }
                        Icon(Icons.Default.ChevronRight, "Controlar sala")
                    }
                } }
            }
            item { Text("Minhas aulas", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge) }
            if (vm.lessons.isEmpty()) item { InfoCard("Sua primeira aula pode começar com um slide e uma pergunta. Toque em “Nova aula”.") }
            items(vm.lessons, key = { "lesson-${it.str("id")}" }) { lesson -> Card(onClick = { vm.editLesson(lesson.str("id")) }, enabled = !vm.busy) {
                Column(Modifier.fillMaxWidth()) {
                    val theme = themeFor(lesson.str("theme"))
                    Surface(color = hexColor(theme.background), modifier = Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            Icon(Icons.Default.AutoAwesomeMotion, null, tint = hexColor(theme.accent), modifier = Modifier.size(34.dp))
                            Text(lesson.str("title"), fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = hexColor(theme.text), maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        }
                    }
                    Row(Modifier.padding(15.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("${lesson.optInt("slideCount")} slides · ${lesson.optInt("questionCount")} perguntas", color = EduMuted)
                            if (lesson.optBoolean("localDirty")) Text("Rascunho neste aparelho", color = EduBlue, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        }
                        IconButton(onClick = { confirmDelete = lesson }, enabled = !vm.busy) { Icon(Icons.Default.DeleteOutline, "Excluir aula") }
                    }
                }
            } }
            if (vm.quizzes.isNotEmpty()) item { Text("Meus quizzes", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
            items(vm.quizzes, key = { "quiz-${it.str("id")}" }) { quiz -> OutlinedCard {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text(quiz.str("title"), fontWeight = FontWeight.Bold); Text("${quiz.arr("questions").length()} perguntas", color = EduMuted) }
                    FilledTonalButton(onClick = { vm.presentQuiz(quiz.str("id")) }, enabled = !vm.busy) { Text("Abrir sala") }
                }
            } }
        }
        item { Text("QuizEdu Android ${BuildConfig.VERSION_NAME} · Feito para aprender juntos", color = EduMuted, fontSize = 12.sp, modifier = Modifier.padding(vertical = 10.dp)) }
    }
    confirmDelete?.let { lesson -> AlertDialog(onDismissRequest = { confirmDelete = null }, title = { Text("Excluir esta aula?") }, text = { Text(lesson.str("title") + " será removida da biblioteca e deste aparelho. As salas já abertas permanecem com sua cópia da aula.") },
        confirmButton = { TextButton(onClick = { confirmDelete = null; vm.deleteLesson(lesson.str("id"), lesson.optInt("revision")) }) { Text("Excluir") } }, dismissButton = { TextButton(onClick = { confirmDelete = null }) { Text("Cancelar") } }) }
}
@Composable fun DevicesScreen(vm: QuizViewModel) {
    var selected by remember { mutableStateOf<JSONObject?>(null) }
    LazyColumn(contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Heading("Aparelhos vinculados", "Revogue o acesso de um aparelho que você não usa mais.") }
        items(vm.devices, key = { it.str("id") }) { device -> OutlinedCard { Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.PhoneAndroid, null, tint = EduBlue); Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) { Text(device.str("deviceName"), fontWeight = FontWeight.Bold); if (device.str("id") == vm.repository.preferences.getString("device_id", "")) Text("Este aparelho", color = EduMuted) }
            TextButton(onClick = { selected = device }, enabled = !vm.busy) { Text("Revogar") }
        } } }
        if (vm.devices.isEmpty()) item { InfoCard("Nenhum aparelho vinculado a esta conta.") }
    }
    selected?.let { device -> AlertDialog(onDismissRequest = { selected = null }, title = { Text("Revogar este aparelho?") }, text = { Text("${device.str("deviceName")} precisará de uma nova autorização para acessar suas aulas.") }, confirmButton = { TextButton(onClick = { selected = null; vm.revokeDevice(device.str("id")) }) { Text("Revogar acesso") } }, dismissButton = { TextButton(onClick = { selected = null }) { Text("Cancelar") } }) }
}
