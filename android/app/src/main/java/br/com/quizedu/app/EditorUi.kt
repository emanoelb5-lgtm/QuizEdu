@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package br.com.quizedu.app

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.roundToInt

private val layouts = listOf("cover" to "Capa", "title" to "Título e texto", "columns" to "Duas colunas", "image" to "Texto e imagem", "quote" to "Citação", "section" to "Seção", "table" to "Tabela", "chart" to "Gráfico", "closing" to "Encerramento", "blank" to "Em branco", "question" to "Quiz", "true_false" to "Verdadeiro ou falso")
@Composable fun EditorScreen(vm: QuizViewModel) {
    val draft = vm.editor ?: return
    val slide = vm.slide ?: return
    val context = LocalContext.current
    var addSlide by remember { mutableStateOf(false) }
    var addObject by remember { mutableStateOf(false) }
    var settings by remember { mutableStateOf(false) }
    var slideMenu by remember { mutableStateOf(false) }
    var deleteConfirm by remember { mutableStateOf(false) }
    var cloudConfirm by remember { mutableStateOf(false) }
    var uploadTarget by remember { mutableStateOf<Triple<String?, Boolean, Boolean>?>(null) }
    val photo = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        val target = uploadTarget
        if (uri != null && target != null) vm.uploadImage(uri, target.first, target.second, target.third)
        uploadTarget = null
    }
    val export = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) try { context.contentResolver.openOutputStream(uri)?.use { it.write(draft.deck.toString(2).toByteArray()) }; vm.notify("Cópia da aula exportada.") }
        catch (_: Exception) { vm.notify("Não foi possível exportar esta cópia.") }
    }
    fun chooseImage(id: String? = null, question: Boolean = false, background: Boolean = false) {
        uploadTarget = Triple(id, question, background)
        photo.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Column(Modifier.padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(draft.deck.str("title"), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(if (draft.dirty) "Rascunho guardado neste aparelho" else "Salva na conta · revisão ${draft.revision}", color = EduMuted, style = MaterialTheme.typography.labelMedium)
                }
                IconButton(onClick = { settings = true }, enabled = !vm.busy) { Icon(Icons.Default.Tune, "Configurar aula") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick = vm::saveLesson, enabled = !vm.busy, modifier = Modifier.weight(1f)) { Icon(Icons.Default.CloudUpload, null); Spacer(Modifier.width(7.dp)); Text("Salvar aula") }
                Button(onClick = vm::presentLesson, enabled = !vm.busy, modifier = Modifier.weight(1f)) { Icon(Icons.Default.PresentToAll, null); Spacer(Modifier.width(7.dp)); Text("Apresentar") }
            }
        } }
        item { Column(Modifier.padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = vm::undo, enabled = vm.canUndo && !vm.busy) { Icon(Icons.Default.Undo, "Desfazer") }
                IconButton(onClick = vm::redo, enabled = vm.canRedo && !vm.busy) { Icon(Icons.Default.Redo, "Refazer") }
                IconButton(onClick = vm::copyObjects, enabled = vm.selection.isNotEmpty() && !vm.busy) { Icon(Icons.Default.ContentCopy, "Copiar objetos") }
                IconButton(onClick = vm::pasteObjects, enabled = vm.canPaste && !vm.busy && slide.str("kind") != "question") { Icon(Icons.Default.ContentPaste, "Colar objetos") }
                Text("${vm.selection.size} selecionados", color = EduMuted, style = MaterialTheme.typography.labelSmall)
            }
            ImportPresentationButton(vm, Modifier.fillMaxWidth())
            if (vm.selection.size > 1) {
                Row { TextButton(onClick = vm::groupSelection) { Text("Agrupar") }; TextButton(onClick = vm::ungroupSelection) { Text("Desagrupar") } }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("left" to "Esquerda", "center" to "Centro", "right" to "Direita", "top" to "Topo", "middle" to "Meio", "bottom" to "Base").forEach { (axis, label) -> item { OutlinedButton(onClick = { vm.alignSelection(axis) }) { Text(label) } } }
                }
            }
        } }
        item { LazyRow(contentPadding = PaddingValues(horizontal = 18.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            itemsIndexed(draft.deck.arr("slides").objects(), key = { _, s -> s.str("id") }) { index, s ->
                Column(Modifier.width(132.dp).border(if (index == vm.slideIndex) 2.dp else 1.dp, if (index == vm.slideIndex) EduBlue else MaterialTheme.colorScheme.outline, RoundedCornerShape(10.dp)).clickable { vm.selectSlide(index) }.padding(5.dp)) {
                    SlideView(s, Modifier.fillMaxWidth())
                    Text("${index + 1} · ${if (s.str("kind") == "question") "Quiz" else s.str("title")}", maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(5.dp))
                }
            }
            item { OutlinedButton(onClick = { addSlide = true }, enabled = !vm.busy, modifier = Modifier.height(100.dp)) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Default.Add, null); Text("Adicionar slide") } } }
        } }
        item { Column(Modifier.padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            SlideView(slide, Modifier.fillMaxWidth(), selected = vm.selectedElement, editable = !vm.busy && slide.str("kind") != "question", onSelect = vm::selectElement, onDrag = vm::moveElement, onResize = vm::resizeElement, selectedIds = vm.selection)
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Slide ${vm.slideIndex + 1} de ${draft.deck.arr("slides").length()}", color = EduMuted, modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelMedium)
                if (slide.str("kind") != "question") TextButton(onClick = { addObject = true }, enabled = !vm.busy) { Icon(Icons.Default.Add, null); Text("Objeto") }
                Box {
                    IconButton(onClick = { slideMenu = true }) { Icon(Icons.Default.MoreHoriz, "Opções do slide") }
                    DropdownMenu(expanded = slideMenu, onDismissRequest = { slideMenu = false }) {
                        DropdownMenuItem(text = { Text("Duplicar slide") }, onClick = { slideMenu = false; vm.duplicateCurrentSlide() })
                        DropdownMenuItem(text = { Text("Mover antes") }, onClick = { slideMenu = false; vm.reorderSlide(-1) }, enabled = vm.slideIndex > 0)
                        DropdownMenuItem(text = { Text("Mover depois") }, onClick = { slideMenu = false; vm.reorderSlide(1) }, enabled = vm.slideIndex < draft.deck.arr("slides").length() - 1)
                        DropdownMenuItem(text = { Text("Excluir slide") }, onClick = { slideMenu = false; deleteConfirm = true })
                    }
                }
            }
            if (slide.str("kind") != "question") Text("Toque para editar. Arraste para mover e use a alça para redimensionar. Selecione vários objetos pela lista abaixo.", style = MaterialTheme.typography.bodySmall, color = EduMuted)
        } }
        if (slide.str("kind") == "question") item { EditorCard { QuestionInspector(vm, slide.getJSONObject("question"), onImage = { chooseImage(question = true) }) } }
        else {
            val selected = slide.arr("elements").objects().find { it.str("id") == vm.selectedElement }
            if (selected != null) item { EditorCard { ObjectInspector(vm, selected, onImage = { chooseImage(selected.str("id")) }) } }
            item { EditorCard {
                Text("Objetos do slide", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                slide.arr("elements").objects().asReversed().forEach { e ->
                    Row(Modifier.fillMaxWidth().clickable { vm.selectElement(e.str("id")) }, verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(e.str("id") in vm.selection, onCheckedChange = { vm.toggleElement(e.str("id")) }, enabled = !vm.busy)
                        Icon(when (e.str("type")) { "image" -> Icons.Default.Image; "shape" -> Icons.Default.Square; "chart" -> Icons.Default.BarChart; "table" -> Icons.Default.TableChart; "video" -> Icons.Default.PlayCircle; else -> Icons.Default.Title }, null, tint = if (e.str("id") == vm.selectedElement) EduBlue else EduMuted)
                        Spacer(Modifier.width(10.dp))
                        Text(when (e.str("type")) { "text" -> plainText(e.optJSONObject("doc")).ifBlank { "Texto" }; "image" -> e.str("alt").ifBlank { "Imagem" }; "shape" -> "Forma"; "table" -> "Tabela"; "chart" -> "Gráfico"; else -> "Vídeo" }, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        IconButton(onClick = { vm.changeElement(e.str("id"), true) { it.put("locked", !it.optBoolean("locked")) } }, enabled = !vm.busy) { Icon(if (e.optBoolean("locked")) Icons.Default.Lock else Icons.Default.LockOpen, if (e.optBoolean("locked")) "Desbloquear objeto" else "Bloquear objeto") }
                        IconButton(onClick = { vm.changeElement(e.str("id"), true) { it.put("hidden", !it.optBoolean("hidden")) } }, enabled = !vm.busy) { Icon(if (e.optBoolean("hidden")) Icons.Default.VisibilityOff else Icons.Default.Visibility, if (e.optBoolean("hidden")) "Mostrar objeto" else "Ocultar objeto") }
                    }
                }
                if (slide.arr("elements").length() == 0) Text("Adicione texto, imagens, formas, tabelas, gráficos ou vídeos.", color = EduMuted)
            } }
        }
        item { EditorCard {
            Text("Slide e anotações", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            OutlinedTextField(slide.str("title"), { value -> vm.changeSlide { it.put("title", value.take(100)) } }, label = { Text("Nome do slide") }, modifier = Modifier.fillMaxWidth(), enabled = !vm.busy)
            ColorField("Cor de fundo", slide.getJSONObject("background").str("color")) { color -> vm.changeSlide { it.getJSONObject("background").put("color", color) } }
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                OutlinedButton(onClick = { chooseImage(background = true) }, enabled = !vm.busy) { Text("Imagem de fundo") }
                if (slide.getJSONObject("background").has("image")) TextButton(onClick = { vm.changeSlide { it.getJSONObject("background").remove("image") } }) { Text("Remover") }
            }
            if (slide.getJSONObject("background").has("image")) NumberSlider("Escurecer fundo", slide.getJSONObject("background").optDouble("overlay").toFloat(), 0f..90f) { value -> vm.changeSlide { it.getJSONObject("background").put("overlay", value.roundToInt()) } }
            ChoiceField("Transição", slide.str("transition"), listOf("none" to "Nenhuma", "fade" to "Suave", "slide" to "Deslizar")) { value -> vm.changeSlide { it.put("transition", value) } }
            OutlinedTextField(slide.str("notes"), { value -> vm.changeSlide { it.put("notes", value.take(3000)) } }, label = { Text("Anotações privadas do professor") }, minLines = 3, maxLines = 8, modifier = Modifier.fillMaxWidth(), enabled = !vm.busy)
            Text("As anotações aparecem no controle do professor. Os alunos não recebem esse conteúdo.", color = EduMuted, style = MaterialTheme.typography.bodySmall)
        } }
        item { Column(Modifier.padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Salvar atualiza sua biblioteca. Salas já abertas usam a cópia da aula escolhida na abertura.", color = EduMuted, style = MaterialTheme.typography.bodySmall)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TextButton(onClick = { export.launch(draft.deck.str("title").replace(Regex("[^\\p{L}\\p{N} _-]"), "").take(80) + ".json") }) { Icon(Icons.Default.Download, null); Spacer(Modifier.width(5.dp)); Text("Exportar cópia") }
                TextButton(onClick = vm::copyLesson, enabled = !vm.busy) { Text("Duplicar aula") }
            }
            if (draft.revision > 0) TextButton(onClick = { cloudConfirm = true }, enabled = !vm.busy) { Text("Abrir versão da conta") }
        } }
    }
    if (addSlide) ModalBottomSheet(onDismissRequest = { addSlide = false }) { LazyColumn(Modifier.testTag("slide-layouts"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        item { Text("Adicionar slide", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 10.dp)) }
        itemsIndexed(layouts) { _, (id, title) -> ListItem(headlineContent = { Text(title) }, leadingContent = { Icon(if (id in listOf("question", "true_false")) Icons.Default.Quiz else Icons.Default.AutoAwesomeMotion, null, tint = EduBlue) }, modifier = Modifier.clickable { addSlide = false; vm.addSlide(id) }) }
    } }
    if (addObject) ModalBottomSheet(onDismissRequest = { addObject = false }) { Column(Modifier.padding(20.dp).padding(bottom = 25.dp)) {
        Text("Adicionar objeto", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        listOf("text" to "Texto", "image" to "Imagem", "shape" to "Forma", "table" to "Tabela", "chart" to "Gráfico", "video" to "Vídeo do YouTube").forEach { (id, label) -> ListItem(headlineContent = { Text(label) }, modifier = Modifier.clickable { addObject = false; vm.addElement(id) }) }
    } }
    if (settings) ModalBottomSheet(onDismissRequest = { settings = false }) { LazyColumn(contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Text("Configurar aula", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        item { OutlinedTextField(draft.deck.str("title"), { value -> vm.changeDeck { it.put("title", value.take(100)) } }, label = { Text("Título da aula") }, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(draft.deck.str("subject"), { value -> vm.changeDeck { it.put("subject", value.take(60)) } }, label = { Text("Disciplina") }, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(draft.deck.str("topic"), { value -> vm.changeDeck { it.put("topic", value.take(60)) } }, label = { Text("Assunto") }, modifier = Modifier.fillMaxWidth()) }
        item { ChoiceField("Tema da aula", draft.deck.str("theme"), deckThemes.map { it.id to it.name }) { value -> vm.changeDeck { d ->
            val before = themeFor(d.str("theme")); val after = themeFor(value); d.put("theme", value)
            d.arr("slides").objects().forEach { s ->
                s.getJSONObject("background").put("color", after.background)
                s.arr("elements").objects().forEach { e ->
                    if (e.str("color") == before.text) e.put("color", after.text)
                    if (e.str("color") == before.accent) e.put("color", after.accent)
                    if (e.str("fill") == before.accent) e.put("fill", after.accent)
                    if (e.str("fill") == before.secondary) e.put("fill", after.secondary)
                    if (e.str("stroke") == before.accent) e.put("stroke", after.accent)
                    if (e.str("font") == before.font) e.put("font", after.font)
                }
            }
        } } }
        item { ChoiceField("Pontuação", draft.deck.str("mode"), listOf("speed" to "Competição: acerto e velocidade", "accuracy" to "Aprendizagem: foco no acerto")) { value -> vm.changeDeck { it.put("mode", value); if (value != "accuracy") it.put("untimed", false) } } }
        if (draft.deck.str("mode") == "accuracy") item { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Text("Perguntas sem limite de tempo", modifier = Modifier.weight(1f)); Switch(draft.deck.optBoolean("untimed"), { value -> vm.changeDeck { it.put("untimed", value) } }) } }
        item { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Text("Mostrar número dos slides", modifier = Modifier.weight(1f)); Switch(draft.deck.optBoolean("showSlideNumbers"), { value -> vm.changeDeck { it.put("showSlideNumbers", value) } }) } }
        item { Button(onClick = { settings = false }, modifier = Modifier.fillMaxWidth()) { Text("Concluir configurações") } }
    } }
    if (deleteConfirm) AlertDialog(onDismissRequest = { deleteConfirm = false }, title = { Text("Excluir este slide?") }, text = { Text("O slide será removido desta edição. As salas já abertas continuam com a cópia original.") }, confirmButton = { TextButton(onClick = { deleteConfirm = false; vm.deleteCurrentSlide() }) { Text("Excluir slide") } }, dismissButton = { TextButton(onClick = { deleteConfirm = false }) { Text("Cancelar") } })
    if (cloudConfirm) AlertDialog(onDismissRequest = { cloudConfirm = false }, title = { Text("Abrir a versão da conta?") }, text = { Text("Se você tem alterações locais, exporte ou duplique a aula antes. A edição deste aparelho será substituída pela versão salva na conta.") }, confirmButton = { TextButton(onClick = { cloudConfirm = false; vm.loadCloudVersion() }) { Text("Abrir versão salva") } }, dismissButton = { TextButton(onClick = { cloudConfirm = false }) { Text("Continuar editando") } })
}
@Composable private fun EditorCard(content: @Composable ColumnScope.() -> Unit) { OutlinedCard(Modifier.fillMaxWidth().padding(horizontal = 18.dp)) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp), content = content) } }
@Composable fun ChoiceField(label: String, value: String, options: List<Pair<String, String>>, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = EduMuted)
        Box { OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) { Text(options.find { it.first == value }?.second ?: value, modifier = Modifier.weight(1f)); Icon(Icons.Default.ExpandMore, null) }
            DropdownMenu(expanded, { expanded = false }) { options.forEach { (key, text) -> DropdownMenuItem(text = { Text(text) }, onClick = { expanded = false; onSelect(key) }) } }
        }
    }
}
@Composable fun ColorField(label: String, current: String, onChange: (String) -> Unit) {
    var text by remember(current) { mutableStateOf(current) }
    val valid = text.matches(Regex("#[a-fA-F0-9]{3}(?:[a-fA-F0-9]{3})?"))
    OutlinedTextField(text, { text = it.take(7); if (it.matches(Regex("#[a-fA-F0-9]{3}(?:[a-fA-F0-9]{3})?"))) onChange(if (it.length == 4) "#" + it.drop(1).map { char -> "$char$char" }.joinToString("") else it) }, label = { Text(label) }, singleLine = true, isError = !valid,
        leadingIcon = { Box(Modifier.size(22.dp).border(1.dp, EduMuted, RoundedCornerShape(5.dp)).then(Modifier).padding(2.dp)) { Surface(color = hexColor(current), modifier = Modifier.fillMaxSize()) {} } }, modifier = Modifier.fillMaxWidth())
}
@Composable fun NumberSlider(label: String, value: Float, range: ClosedFloatingPointRange<Float>, onChange: (Float) -> Unit) {
    Column { Row(Modifier.fillMaxWidth()) { Text(label, modifier = Modifier.weight(1f), color = EduMuted, style = MaterialTheme.typography.labelLarge); Text(value.roundToInt().toString(), style = MaterialTheme.typography.labelLarge) }; Slider(value.coerceIn(range), onChange, valueRange = range) }
}
@Composable private fun NumberField(label: String, value: Float, modifier: Modifier = Modifier, onChange: (Float) -> Unit) {
    var input by remember(value) { mutableStateOf(if (value == value.roundToInt().toFloat()) value.roundToInt().toString() else "%.1f".format(java.util.Locale.US, value)) }
    OutlinedTextField(input, { input = it.take(10); it.replace(',', '.').toFloatOrNull()?.takeIf(Float::isFinite)?.let(onChange) }, singleLine = true, label = { Text(label) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = modifier)
}
@Composable private fun ObjectInspector(vm: QuizViewModel, e: JSONObject, onImage: () -> Unit) {
    val id = e.str("id")
    var expandedText by remember(id) { mutableStateOf(false) }
    if (expandedText) ExpandedTextEditor(e, onClose = { expandedText = false }, onSave = { doc -> vm.changeElement(id) { it.put("doc", doc) } }); val locked = e.optBoolean("locked")
    fun update(change: (JSONObject) -> Unit) { vm.changeElement(id) { obj ->
        val previous = obj.copy(); change(obj)
        if (obj.str("type") == "text") {
            val attrs = JSONObject()
            if (previous.str("color") != obj.str("color")) attrs.put("color", obj.str("color"))
            if (previous.str("font") != obj.str("font")) attrs.put("fontFamily", obj.str("font"))
            if (previous.optDouble("fontSize") != obj.optDouble("fontSize")) attrs.put("fontSize", "${obj.optDouble("fontSize")}px")
            if (attrs.length() > 0) obj.put("doc", formatStyledText(obj.optJSONObject("doc"), 0, 0, "textStyle", attrs))
            if (previous.str("align") != obj.str("align")) obj.optJSONObject("doc")?.arr("content")?.objects()?.forEach { p -> p.put("attrs", (p.optJSONObject("attrs") ?: JSONObject()).put("textAlign", obj.str("align"))) }
        }
        obj
    } }
    Text("Editar ${when (e.str("type")) { "text" -> "texto"; "image" -> "imagem"; "shape" -> "forma"; "table" -> "tabela"; "chart" -> "gráfico"; else -> "vídeo" }}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
    if (locked) {
        InfoCard("Este objeto está bloqueado. Desbloqueie para editar ou mover.")
        OutlinedButton(onClick = { vm.changeElement(id, true) { it.put("locked", false) } }) { Text("Desbloquear objeto") }
        return
    }
    when (e.str("type")) {
        "text" -> {
            val plain = plainText(e.optJSONObject("doc"))
            val bold = e.optJSONObject("doc")?.toString()?.contains("\"type\":\"bold\"") == true
            val italic = e.optJSONObject("doc")?.toString()?.contains("\"type\":\"italic\"") == true
            OutlinedTextField(plain, { value -> update { it.put("doc", replaceStyledText(it.optJSONObject("doc"), value.take(16000))) } }, label = { Text("Conteúdo do texto") }, minLines = 3, maxLines = 9, modifier = Modifier.fillMaxWidth(), enabled = !vm.busy)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(bold, { update { it.put("doc", formatStyledText(it.optJSONObject("doc"), 0, 0, "bold")) } }, label = { Text("Negrito", fontWeight = FontWeight.Bold) })
                FilterChip(italic, { update { it.put("doc", formatStyledText(it.optJSONObject("doc"), 0, 0, "italic")) } }, label = { Text("Itálico") })
            }
            OutlinedButton(onClick = { expandedText = true }) { Text("Ampliar e formatar trechos") }
            ChoiceField("Fonte", e.str("font"), listOf("Arial", "Georgia", "Verdana", "Trebuchet MS", "Times New Roman", "Courier New").map { it to it }) { value -> update { it.put("font", value) } }
            NumberSlider("Tamanho da fonte", e.optDouble("fontSize", 30.0).toFloat(), 8f..160f) { value -> update { it.put("fontSize", value.roundToInt()) } }
            ColorField("Cor do texto", e.str("color")) { color -> update { it.put("color", color) } }
            ChoiceField("Alinhamento", e.str("align"), listOf("left" to "Esquerda", "center" to "Centro", "right" to "Direita", "justify" to "Justificado")) { value -> update { it.put("align", value) } }
        }
        "image" -> {
            Button(onClick = onImage, enabled = !vm.busy) { Icon(Icons.Default.Image, null); Spacer(Modifier.width(8.dp)); Text(if (e.str("src").isEmpty()) "Adicionar imagem" else "Trocar imagem") }
            OutlinedTextField(e.str("alt"), { value -> update { it.put("alt", value.take(180)) } }, label = { Text("Descrição da imagem") }, modifier = Modifier.fillMaxWidth())
            ChoiceField("Ajuste", e.str("fit"), listOf("cover" to "Preencher", "contain" to "Mostrar inteira")) { value -> update { it.put("fit", value) } }
            NumberSlider("Recorte horizontal", e.optDouble("positionX", 50.0).toFloat(), 0f..100f) { value -> update { it.put("positionX", value.roundToInt()) } }
            NumberSlider("Recorte vertical", e.optDouble("positionY", 50.0).toFloat(), 0f..100f) { value -> update { it.put("positionY", value.roundToInt()) } }
        }
        "shape" -> {
            ChoiceField("Forma", e.str("shape"), listOf("rect" to "Retângulo", "ellipse" to "Elipse", "line" to "Linha", "arrow" to "Seta", "triangle" to "Triângulo")) { value -> update { it.put("shape", value) } }
            ColorField("Preenchimento", e.str("fill")) { value -> update { it.put("fill", value) } }
            ColorField("Cor da borda", e.str("stroke")) { value -> update { it.put("stroke", value) } }
            NumberSlider("Espessura da borda", e.optDouble("strokeWidth", 2.0).toFloat(), 0f..20f) { value -> update { it.put("strokeWidth", value.roundToInt()) } }
            NumberSlider("Cantos arredondados", e.optDouble("radius", 12.0).toFloat(), 0f..100f) { value -> update { it.put("radius", value.roundToInt()) } }
        }
        "table" -> {
            val cells = e.arr("cells")
            Text("Uma linha por linha da tabela. Separe as colunas por |. Até 8 linhas e 6 colunas.", color = EduMuted, style = MaterialTheme.typography.bodySmall)
            val value = (0 until cells.length()).joinToString("\n") { cells.optJSONArray(it)?.strings()?.joinToString(" | ") ?: "" }
            var text by remember(id) { mutableStateOf(value) }
            OutlinedTextField(text, { raw -> text = raw; val rows = raw.split("\n").take(8).map { line -> line.split('|').take(6).map { it.trim().take(200) } }; val columns = rows.maxOfOrNull { it.size } ?: 1
                update { it.put("cells", jsonArray(rows.map { row -> jsonArray(List(columns) { i -> row.getOrElse(i) { "" } }) })) }
            }, label = { Text("Dados da tabela") }, minLines = 4, maxLines = 10, modifier = Modifier.fillMaxWidth())
            Row(verticalAlignment = Alignment.CenterVertically) { Text("Linha de cabeçalho", modifier = Modifier.weight(1f)); Switch(e.optBoolean("header"), { value -> update { it.put("header", value) } }) }
            ColorField("Cor do cabeçalho", e.str("fill")) { value -> update { it.put("fill", value) } }
            ColorField("Cor do texto", e.str("color")) { value -> update { it.put("color", value) } }
            NumberSlider("Tamanho do texto", e.optDouble("fontSize", 24.0).toFloat(), 8f..80f) { value -> update { it.put("fontSize", value.roundToInt()) } }
        }
        "chart" -> {
            ChoiceField("Tipo de gráfico", e.str("chart"), listOf("bar" to "Barras", "line" to "Linha", "pie" to "Pizza")) { value -> update { it.put("chart", value) } }
            val value = e.arr("labels").strings().mapIndexed { index, label -> "$label | ${e.arr("values").optDouble(index)}" }.joinToString("\n")
            var text by remember(id) { mutableStateOf(value) }
            var invalid by remember { mutableStateOf(false) }
            OutlinedTextField(text, { raw -> text = raw; val rows = raw.split("\n").filter { it.isNotBlank() }.take(12).map { it.split('|', limit = 2) }
                val valid = rows.isNotEmpty() && rows.all { row -> row.size == 2 && row[0].trim().length in 1..80 && row[1].trim().replace(',', '.').toDoubleOrNull()?.let { it.isFinite() && it in 0.0..1000000000.0 } == true }
                invalid = !valid
                if (valid) update { it.put("labels", jsonArray(rows.map { row -> row[0].trim() })).put("values", jsonArray(rows.map { row -> row[1].trim().replace(',', '.').toDouble() })) }
            }, label = { Text("Rótulo | valor (uma linha por item)") }, isError = invalid, minLines = 4, maxLines = 12, modifier = Modifier.fillMaxWidth())
            if (invalid) Text("Use até 12 linhas com rótulo e valor não negativo, separados por |.", color = MaterialTheme.colorScheme.error)
            ColorField("Cor do gráfico", e.str("fill")) { value -> update { it.put("fill", value) } }
        }
        "video" -> {
            var input by remember(id) { mutableStateOf(e.str("videoId")) }
            OutlinedTextField(input, { raw -> input = raw; if (raw.isBlank()) update { it.put("videoId", "") } else videoId(raw)?.let { valid -> update { it.put("videoId", valid) } } }, label = { Text("Link ou código do YouTube") }, isError = input.isNotBlank() && videoId(input) == null, modifier = Modifier.fillMaxWidth())
            NumberField("Começar em (segundos)", e.optInt("videoStart").toFloat(), Modifier.fillMaxWidth()) { value -> update { it.put("videoStart", value.roundToInt().coerceIn(0, 86400)) } }
            Text("Durante a apresentação no Android, o vídeo abre no YouTube. O computador continua sendo a tela principal da aula.", color = EduMuted, style = MaterialTheme.typography.bodySmall)
        }
    }
    HorizontalDivider()
    Text("Posição e tamanho", fontWeight = FontWeight.Bold)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        NumberField("X", e.optDouble("x").toFloat(), Modifier.weight(1f)) { value -> vm.changeElement(id) { boundedGeometry(it, value, it.optDouble("y").toFloat()) } }
        NumberField("Y", e.optDouble("y").toFloat(), Modifier.weight(1f)) { value -> vm.changeElement(id) { boundedGeometry(it, it.optDouble("x").toFloat(), value) } }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        NumberField("Largura", e.optDouble("w").toFloat(), Modifier.weight(1f)) { value -> vm.changeElement(id) { boundedGeometry(it, it.optDouble("x").toFloat(), it.optDouble("y").toFloat(), value) } }
        NumberField("Altura", e.optDouble("h").toFloat(), Modifier.weight(1f)) { value -> vm.changeElement(id) { boundedGeometry(it, it.optDouble("x").toFloat(), it.optDouble("y").toFloat(), h = value) } }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        OutlinedButton(onClick = { vm.changeElement(id) { boundedGeometry(it, 0f, it.optDouble("y").toFloat()) } }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(8.dp)) { Icon(Icons.Default.AlignHorizontalLeft, "Alinhar à esquerda") }
        OutlinedButton(onClick = { vm.changeElement(id) { boundedGeometry(it, (SLIDE_W - it.optDouble("w").toFloat()) / 2, it.optDouble("y").toFloat()) } }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(8.dp)) { Icon(Icons.Default.AlignHorizontalCenter, "Centralizar") }
        OutlinedButton(onClick = { vm.changeElement(id) { boundedGeometry(it, SLIDE_W - it.optDouble("w").toFloat(), it.optDouble("y").toFloat()) } }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(8.dp)) { Icon(Icons.Default.AlignHorizontalRight, "Alinhar à direita") }
    }
    NumberSlider("Rotação", e.optDouble("rotation").toFloat(), -180f..180f) { value -> update { it.put("rotation", value.roundToInt()) } }
    NumberSlider("Opacidade", e.optDouble("opacity", 100.0).toFloat(), 0f..100f) { value -> update { it.put("opacity", value.roundToInt()) } }
    NumberSlider("Etapa de aparição (0 = desde o início)", e.optInt("build").toFloat(), 0f..20f) { value -> update { it.put("build", value.roundToInt()) } }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        TextButton(onClick = { vm.changeSlide { s -> val elements = s.arr("elements").objects().toMutableList(); elements.removeAll { it.str("id") == id }; elements.add(e.copy()); s.put("elements", jsonArray(elements)) } }) { Text("Trazer à frente") }
        TextButton(onClick = { vm.changeSlide { s -> val elements = s.arr("elements").objects().toMutableList(); elements.removeAll { it.str("id") == id }; elements.add(0, e.copy()); s.put("elements", jsonArray(elements)) } }) { Text("Enviar atrás") }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        TextButton(onClick = { if ((vm.slide?.arr("elements")?.length() ?: 60) >= 60) vm.notify("Use até 60 objetos.") else {
            val copy = boundedGeometry(e, e.optDouble("x").toFloat() + 20, e.optDouble("y").toFloat() + 20).put("id", uid()); copy.remove("group")
            vm.changeSlide { it.arr("elements").put(copy) }; vm.selectElement(copy.str("id"))
        } }) { Icon(Icons.Default.ContentCopy, null); Spacer(Modifier.width(5.dp)); Text("Duplicar") }
        TextButton(onClick = { vm.changeSlide { s -> s.put("elements", jsonArray(s.arr("elements").objects().filter { it.str("id") != id })) }; vm.selectElement(null) }) { Icon(Icons.Default.DeleteOutline, null); Spacer(Modifier.width(5.dp)); Text("Excluir objeto") }
    }
}
@Composable private fun QuestionInspector(vm: QuizViewModel, q: JSONObject, onImage: () -> Unit) {
    fun update(change: (JSONObject) -> Unit) { vm.changeSlide { change(it.getJSONObject("question")) } }
    Text("Pergunta para a turma", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    OutlinedTextField(q.str("text"), { value -> update { it.put("text", value.take(400)) } }, label = { Text("Enunciado") }, minLines = 2, maxLines = 5, modifier = Modifier.fillMaxWidth())
    ChoiceField("Modelo", q.str("kind", "multiple"), listOf("multiple" to "Múltipla escolha", "true_false" to "Verdadeiro ou falso", "image" to "Identificar uma imagem", "scenario" to "Situação prática")) { value -> update {
        if (value == "true_false" && it.str("kind") != value) { it.put("options", JSONArray(listOf("Verdadeiro", "Falso"))).put("correct", -1); it.remove("optionImages") }
        else if (it.str("kind") == "true_false" && value != "true_false") { it.put("options", JSONArray(listOf("", "", "", ""))).put("correct", -1); it.remove("optionImages") }
        it.put("kind", value)
    } }
    Text("Marque a resposta correta", fontWeight = FontWeight.Bold)
    q.arr("options").strings().forEachIndexed { index, option -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        RadioButton(q.optInt("correct", -1) == index, onClick = { update { it.put("correct", index) } })
        OutlinedTextField(option, { value -> update { it.arr("options").put(index, value.take(180)) } }, label = { Text("Alternativa ${('A'.code + index).toChar()}") }, modifier = Modifier.weight(1f), readOnly = q.str("kind") == "true_false", maxLines = 3)
    } }
    if (q.str("kind") != "true_false") Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { update { val count = it.arr("options").length(); if (count < 4) { it.arr("options").put(""); it.optJSONArray("optionImages")?.put("") } } }, enabled = q.arr("options").length() < 4) { Text("Adicionar opção") }
        TextButton(onClick = { update { val count = it.arr("options").length(); if (count > 2) { it.arr("options").remove(count - 1); it.optJSONArray("optionImages")?.remove(count - 1); if (it.optInt("correct") >= count - 1) it.put("correct", -1) } } }, enabled = q.arr("options").length() > 2) { Text("Remover última") }
    }
    ChoiceField("Tempo da pergunta", q.optInt("seconds", 30).toString(), durations.map { it.toString() to "$it segundos" }) { value -> update { it.put("seconds", value.toInt()) } }
    OutlinedButton(onClick = onImage, enabled = !vm.busy) { Icon(Icons.Default.Image, null); Spacer(Modifier.width(8.dp)); Text(if (q.str("image").isBlank()) "Adicionar imagem da pergunta" else "Trocar imagem") }
    if (q.str("image").isNotBlank()) {
        OutlinedTextField(q.str("imageAlt"), { value -> update { it.put("imageAlt", value.take(180)) } }, label = { Text("Descrição da imagem") }, modifier = Modifier.fillMaxWidth())
        TextButton(onClick = { update { it.remove("image"); it.remove("imageAlt") } }) { Text("Remover imagem") }
    }
    OutlinedTextField(q.str("explanation"), { value -> update { it.put("explanation", value.take(500)) } }, label = { Text("Explicação após a resposta") }, minLines = 2, maxLines = 5, modifier = Modifier.fillMaxWidth())
    InfoCard("A resposta correta fica privada até o fim da rodada. A pontuação é calculada pelo mesmo mecanismo do site.")
}
