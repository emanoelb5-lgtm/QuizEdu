package br.com.quizedu.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import android.util.Base64

@Composable fun ImportPresentationButton(vm: QuizViewModel, modifier: Modifier = Modifier) {
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> if (uri != null) vm.prepareImport(uri) }
    OutlinedButton(onClick = { picker.launch(arrayOf("*/*")) }, enabled = !vm.busy, modifier = modifier) { Icon(Icons.Default.FileUpload, null); Spacer(Modifier.width(7.dp)); Text("Importar apresentação") }
}
@Composable fun PresentationImportPreview(vm: QuizViewModel) {
    val result = vm.pendingImport ?: return
    val slides = result.deck.arr("slides").objects()
    var selected by remember(result) { mutableStateOf(slides.indices.toSet()) }
    var preview by remember(result) { mutableStateOf(0) }
    val images = remember(result) { result.assets.associate { "/api/media/${it.str("id")}" to Base64.decode(it.str("data"), Base64.NO_WRAP) } }
    val remaining = 150 - (vm.editor?.deck?.arr("slides")?.length() ?: 0)
    val remainingQuestions = 50 - (vm.editor?.deck?.arr("slides")?.objects()?.count { it.str("kind") == "question" } ?: 0)
    val overflow = selected.size > remaining || selected.count { slides[it].str("kind") == "question" } > remainingQuestions
    Dialog(onDismissRequest = { if (!vm.busy) vm.cancelImport() }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(modifier = Modifier.fillMaxWidth().fillMaxHeight(.94f).padding(12.dp), shape = MaterialTheme.shapes.large) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Importar apresentação", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("${result.format} · ${slides.size} slides · ${result.deck.str("title")}", color = EduMuted)
                if (slides.isNotEmpty()) SlideView(slides[preview], Modifier.fillMaxWidth(), imageOverrides = images)
                LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    itemsIndexed(result.warnings) { _, warning -> Text(warning, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    item { Row { TextButton(onClick = { selected = slides.indices.toSet() }, enabled = !vm.busy) { Text("Selecionar todos") }; TextButton(onClick = { selected = emptySet() }, enabled = !vm.busy) { Text("Limpar") } } }
                    itemsIndexed(slides) { index, slide -> Row(Modifier.fillMaxWidth().clickable(enabled = !vm.busy) { preview = index }) {
                        Checkbox(index in selected, onCheckedChange = { checked -> selected = if (checked) selected + index else selected - index }, enabled = !vm.busy)
                        Column(Modifier.padding(top = 12.dp).weight(1f)) { Text("${index + 1}. ${slide.str("title")}", maxLines = 2); if (index == preview) Text("Em prévia", color = EduBlue, style = MaterialTheme.typography.labelSmall) }
                    } }
                }
                Text("${selected.size} selecionados · cabem $remaining slides", color = if (overflow) MaterialTheme.colorScheme.error else EduMuted)
                vm.importError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (vm.busy) { LinearProgressIndicator(Modifier.fillMaxWidth()); Text("Processando e guardando imagens…", color = EduMuted) }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = vm::cancelImport, enabled = !vm.busy, modifier = Modifier.weight(1f)) { Text("Cancelar") }
                    Button(onClick = { vm.acceptImport(selected) }, enabled = !vm.busy && selected.isNotEmpty() && !overflow, modifier = Modifier.weight(1f)) { Text("Importar slides") }
                }
            }
        }
    }
}
