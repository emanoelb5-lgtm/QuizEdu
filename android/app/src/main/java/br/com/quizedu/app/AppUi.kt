@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package br.com.quizedu.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
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
import androidx.compose.ui.res.painterResource
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

val EduBlue = Color(0xFF6546D7)
val EduNavy = Color(0xFF23213D)
val EduLime = Color(0xFFFFB35C)
val EduMuted = Color(0xFF69657B)
@Composable fun QuizEduTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = lightColorScheme(primary = EduBlue, onPrimary = Color.White, secondary = EduNavy, tertiary = EduLime,
        background = Color(0xFFF8F7FC), surface = Color.White, onSurface = EduNavy, outline = Color(0xFFE3DFEE), surfaceVariant = Color(0xFFF0EDFF)),
        shapes = Shapes(small = RoundedCornerShape(12.dp), medium = RoundedCornerShape(18.dp), large = RoundedCornerShape(24.dp)), content = content)
}
fun openWeb(context: Context, path: String) {
    val url = if (path.startsWith("/")) BuildConfig.SITE_URL + path else path
    try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) { }
}
@Composable fun QuizEduApp(vm: QuizViewModel) {
    if (vm.pendingImport != null) PresentationImportPreview(vm)
    val snack = remember { SnackbarHostState() }
    val context = LocalContext.current
    var openPairingBrowser by remember { mutableStateOf(false) }
    val signIn: () -> Unit = {
        vm.mode(true)
        if (vm.pendingPair.isNotBlank()) openWeb(context, "/vincular-app?id=${vm.pendingPair}")
        else { openPairingBrowser = true; vm.startPairing() }
    }
    LaunchedEffect(vm.pendingPair) {
        if (openPairingBrowser && vm.pendingPair.isNotBlank()) {
            openPairingBrowser = false
            openWeb(context, "/vincular-app?id=${vm.pendingPair}")
        }
    }
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
                Image(painterResource(R.drawable.ic_prativerso), contentDescription = null, modifier = Modifier.size(34.dp))
                Text("Prativerso", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = EduNavy, maxLines = 1)
            } }, navigationIcon = { if (vm.screen != AppScreen.Home && !(vm.screen == AppScreen.Room && !vm.roomTeacher)) IconButton(onClick = { if (vm.screen == AppScreen.Room) exitConfirm = true else if (vm.screen == AppScreen.Editor) vm.closeEditor() else vm.home() }, enabled = !vm.busy) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar") } },
                actions = { if (vm.screen == AppScreen.Room && !vm.roomTeacher) TextButton(onClick = { exitConfirm = true }, enabled = !vm.busy, modifier = Modifier.testTag("student-exit")) { Icon(Icons.Default.Logout, null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(5.dp)); Text("Sair") }; if (vm.screen == AppScreen.Home) { if (vm.profile == null) TextButton(onClick = signIn, enabled = !vm.busy, modifier = Modifier.testTag("home-sign-in")) { Text("Entrar", fontWeight = FontWeight.Bold) } else TextButton(onClick = { vm.mode(!vm.teacher) }, enabled = !vm.busy) { Text(if (vm.teacher) "Participar" else "Minhas atividades") } } })
            if (vm.busy) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }
    }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
            when (vm.screen) {
                AppScreen.Home -> if (vm.teacher) TeacherHome(vm, signIn) else StudentHome(vm)
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
    Surface(color = if (warning) Color(0xFFFFF4DD) else Color(0xFFF0EDFF), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
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
        item { Heading("Entrar em uma sala") }
        item { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(value = code, onValueChange = { code = it.filter(Char::isDigit).take(6) }, singleLine = true,
                label = { Text("Código da sala") }, placeholder = { Text("000000") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().testTag("home-room-code"), textStyle = MaterialTheme.typography.headlineMedium)
            Text("Para participar, você não precisa de conta.", color = EduMuted, style = MaterialTheme.typography.bodyMedium)
        } }
        if (vm.profile == null) item { TextButton(onClick = { vm.mode(true) }, modifier = Modifier.testTag("home-create")) {
            Icon(Icons.Default.PresentToAll, null); Spacer(Modifier.width(8.dp)); Text("Criar uma atividade")
        } }
        val previous = vm.repository.preferences.getString("student_room", "") ?: ""
        if (previous.matches(Regex("[0-9]{6}"))) item { OutlinedCard(onClick = { vm.openRoom(previous, false) }) {
            Row(Modifier.padding(18.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Restore, null, tint = EduBlue); Spacer(Modifier.width(12.dp)); Column { Text("Retomar minha sala", fontWeight = FontWeight.Bold); Text("Código $previous", color = EduMuted) } }
        } }
    }
    Surface(color = Color.White, shadowElevation = 8.dp, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(horizontal = 22.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { vm.acceptLink(code) }, enabled = code.length == 6, modifier = Modifier.fillMaxWidth().height(54.dp)) { Text("Entrar na sala", fontWeight = FontWeight.Bold) }
            OutlinedButton(onClick = { scanner.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Leia o QR code da sala Prativerso").setBeepEnabled(false).setOrientationLocked(false)) }, modifier = Modifier.fillMaxWidth().height(54.dp)) {
                Icon(Icons.Default.QrCodeScanner, null); Spacer(Modifier.width(10.dp)); Text("Ler QR code")
            }
        }
    }
    }
}
@Composable fun TeacherHome(vm: QuizViewModel, onSignIn: () -> Unit) {
    val context = LocalContext.current
    var name by rememberSaveable { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf<JSONObject?>(null) }
    var trialOpen by remember { mutableStateOf(false) }
    var createAfterTrial by remember { mutableStateOf(false) }
    LaunchedEffect(vm.profile, vm.busy) {
        if (createAfterTrial && vm.profile != null && !vm.busy) { createAfterTrial = false; vm.newLesson() }
    }
    if (trialOpen) AlertDialog(onDismissRequest = { if (!vm.busy) trialOpen = false }, title = { Text("Experimentar sem conta") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(value = name, onValueChange = { name = it.take(30) }, label = { Text("Seu nome") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("trial-name"))
            Text("O acesso temporário dura 30 dias neste aparelho.", color = EduMuted)
        } }, confirmButton = { TextButton(onClick = { createAfterTrial = true; trialOpen = false; vm.temporary(name.trim()) }, enabled = name.trim().length >= 2 && !vm.busy) { Text("Continuar") } },
        dismissButton = { TextButton(onClick = { trialOpen = false }, enabled = !vm.busy) { Text("Cancelar") } })
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { Heading(if (vm.profile == null) "Criar uma atividade" else "Minhas apresentações") }
        if (vm.pendingPair.isNotBlank()) item { ElevatedCard {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                Text("Entrar na conta", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Continue no navegador para vincular este aparelho.", color = EduMuted)
                Button(onClick = { openWeb(context, "/vincular-app?id=${vm.pendingPair}") }, modifier = Modifier.fillMaxWidth()) { Text("Continuar no navegador") }
                TextButton(onClick = vm::cancelPairing) { Text("Cancelar vínculo") }
            }
        } }
        if (vm.profile == null) {
            if (vm.pendingPair.isBlank()) {
                item { OutlinedCard { Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
                    Icon(Icons.Default.PresentToAll, null, tint = EduBlue, modifier = Modifier.size(32.dp))
                    Text("Apresentações com perguntas ao vivo", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("Crie slides ou importe uma apresentação.", color = EduMuted)
                    Button(onClick = onSignIn, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Criar com minha conta") }
                    TextButton(onClick = { trialOpen = true }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().testTag("home-trial")) { Text("Experimentar sem conta") }
                } } }
                item { OutlinedButton(onClick = { vm.mode(false) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                    Icon(Icons.Default.QrCode, null); Spacer(Modifier.width(8.dp)); Text("Entrar em uma sala")
                } }
            }
        } else {
            item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = vm::newLesson, enabled = !vm.busy, modifier = Modifier.weight(1f).heightIn(min = 52.dp)) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(7.dp)); Text("Nova apresentação") }
                IconButton(onClick = vm::refreshLibrary, enabled = !vm.busy) { Icon(Icons.Default.Refresh, "Atualizar aulas") }
                Box { IconButton(onClick = { expanded = true }) { Icon(Icons.Default.MoreVert, "Opções da conta") }
                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        DropdownMenuItem(text = { Text("Vincular ou trocar conta") }, onClick = { expanded = false; onSignIn() })
                        DropdownMenuItem(text = { Text("Aparelhos vinculados") }, onClick = { expanded = false; vm.showDevices() })
                        DropdownMenuItem(text = { Text("Abrir Prativerso no navegador") }, onClick = { expanded = false; openWeb(context, "/aulas") })
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
            if (vm.activeRooms.isNotEmpty()) item { Text("Apresentações", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge) }
            if (vm.lessons.isEmpty()) item { Text("Você ainda não tem apresentações.", color = EduMuted) }
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
            item { OutlinedCard { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Exemplos para adaptar", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                OutlinedButton(onClick = { vm.useExample(true) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().testTag("presentation-example")) { Icon(Icons.Default.AutoAwesomeMotion, null); Spacer(Modifier.width(8.dp)); Text("Usar apresentação de exemplo") }
                OutlinedButton(onClick = { vm.useExample(false) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().testTag("quiz-example")) { Icon(Icons.Default.Quiz, null); Spacer(Modifier.width(8.dp)); Text("Usar quiz de exemplo") }
            } } }
        }
        item { Text("Prativerso Android ${BuildConfig.VERSION_NAME} · Conhecimento em prática", color = EduMuted, fontSize = 12.sp, modifier = Modifier.padding(vertical = 10.dp)) }
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
