package br.com.quizedu.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import org.json.JSONObject
import java.text.Normalizer
import java.util.Locale

fun filterReadyLessons(lessons: List<JSONObject>, subject: String, grade: String, query: String): List<JSONObject> {
    fun normalize(value: String) = Normalizer.normalize(value, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "").lowercase(Locale.forLanguageTag("pt-BR"))
    val terms = normalize(query.take(120)).trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    return lessons.filter { lesson ->
        (subject.isBlank() || lesson.str("subjectId") == subject) && (grade.isBlank() || lesson.str("grade") == grade) && terms.all {
            it in normalize(listOf("title", "description", "subject", "gradeLabel", "unit").joinToString(" ") { key -> lesson.str(key) } + " " + lesson.arr("tags").strings().joinToString(" "))
        }
    }
}

@Composable fun LessonCatalogScreen(vm: QuizViewModel, onSignIn: () -> Unit) {
    val detail = vm.readyDetail
    if (detail != null) { ReadyLessonDetail(vm, detail, onSignIn); return }
    var query by rememberSaveable { mutableStateOf("") }
    var subject by rememberSaveable { mutableStateOf("") }
    var grade by rememberSaveable { mutableStateOf("") }
    val catalog = vm.readyCatalog
    val lessons = filterReadyLessons(catalog?.arr("lessons")?.objects() ?: emptyList(), subject, grade, query)
    LazyColumn(Modifier.fillMaxSize().testTag("lesson-catalog"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Heading("Aulas prontas", "Escolha a disciplina, encontre uma aula e adapte para sua turma.") }
        item { OutlinedTextField(query, { query = it.take(120) }, label = { Text("Pesquisar aula ou assunto") }, leadingIcon = { Icon(Icons.Default.Search, null) }, modifier = Modifier.fillMaxWidth().testTag("lesson-search"), singleLine = true) }
        item { LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item { FilterChip(subject.isBlank(), { subject = "" }, label = { Text("Todas as disciplinas") }) }
            items(catalog?.arr("subjects")?.objects() ?: emptyList(), key = { it.str("id") }) { item -> FilterChip(subject == item.str("id"), { subject = item.str("id") }, label = { Text(item.str("name")) }) }
        } }
        item { LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item { FilterChip(grade.isBlank(), { grade = "" }, label = { Text("Todos os anos") }) }
            items(catalog?.arr("grades")?.objects() ?: emptyList(), key = { it.str("id") }) { item -> FilterChip(grade == item.str("id"), { grade = item.str("id") }, label = { Text(item.str("name")) }) }
        } }
        if (vm.catalogOffline) item { InfoCard("Mostrando o catálogo guardado neste aparelho. Reconecte para buscar novidades e salvar uma cópia.", true) }
        item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("${lessons.size} aulas", color = EduMuted)
            TextButton(onClick = vm::browseReadyLessons, enabled = !vm.busy) { Icon(Icons.Default.Refresh, null); Text("Atualizar") }
        } }
        items(lessons, key = { it.str("id") }) { lesson -> ElevatedCard(onClick = { vm.previewReadyLesson(lesson.str("id")) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().testTag("ready-${lesson.str("id")}")) {
            mediaUrl(lesson.str("thumbnail"))?.let { AsyncImage(it, lesson.str("title"), contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f)) }
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("${lesson.str("subject")} · ${lesson.str("gradeLabel")}", color = EduBlue, fontWeight = FontWeight.Bold)
                Text(lesson.str("title"), fontSize = 24.sp, fontWeight = FontWeight.Bold)
                Text(lesson.str("unit"), color = EduMuted)
                Text(lesson.str("description"))
                Text(lessonActivitySummary(lesson), color = EduMuted, style = MaterialTheme.typography.bodySmall)
                Row(verticalAlignment = Alignment.CenterVertically) { Text("Conhecer esta aula", color = EduBlue, fontWeight = FontWeight.Bold); Icon(Icons.Default.ChevronRight, null, tint = EduBlue) }
            }
        } }
        if (lessons.isEmpty() && !vm.busy) item { InfoCard(if (catalog == null) "O catálogo não carregou. Toque em atualizar para tentar novamente." else "Nenhuma aula encontrada. Tente outro assunto ou ano.") }
    }
}

@Composable private fun ReadyLessonDetail(vm: QuizViewModel, detail: JSONObject, onSignIn: () -> Unit) {
    val lesson = detail.optJSONObject("lesson") ?: return
    val deck = detail.optJSONObject("presentation") ?: return
    val slides = deck.arr("slides").objects()
    var index by rememberSaveable(lesson.str("id")) { mutableIntStateOf(0) }
    var showText by remember { mutableStateOf(false) }
    var showEntry by remember { mutableStateOf(false) }
    var name by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("ready-preview"), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item { TextButton(onClick = vm::closeReadyDetail, enabled = !vm.busy) { Text("Voltar ao catálogo") } }
            item { Heading(lesson.str("title"), "${lesson.str("subject")} · ${lesson.str("gradeLabel")} · ${lesson.str("unit")}") }
            item { Text(lesson.str("description")) }
            if (vm.catalogOffline) item { InfoCard("Prévia guardada neste aparelho. Salvar na conta precisa de conexão.", true) }
            if (slides.isNotEmpty()) item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SlideView(slides[index.coerceIn(slides.indices)], Modifier.fillMaxWidth())
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        OutlinedButton(onClick = { index-- }, enabled = index > 0) { Text("Anterior") }
                        Text("${index + 1}/${slides.size}", color = EduMuted)
                        OutlinedButton(onClick = { index++ }, enabled = index < slides.lastIndex) { Text("Próximo") }
                    }
                }
            }
            item { Text("Objetivos da aula", fontWeight = FontWeight.Bold, fontSize = 20.sp) }
            items(lesson.arr("objectives").strings()) { objective -> Text("• $objective") }
            if (detail.optJSONObject("supportText") != null) item { OutlinedButton(onClick = { showText = true }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.MenuBook, null); Spacer(Modifier.width(8.dp)); Text("Ler texto de apoio") } }
            item { InfoCard("Você recebe uma cópia editável. Ajuste os slides e as perguntas e abra uma sala para participar com a turma.") }
        }
        Surface(shadowElevation = 8.dp, modifier = Modifier.fillMaxWidth()) {
            Button(onClick = { if (vm.profile == null) showEntry = true else vm.useReadyLesson() }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().padding(18.dp).heightIn(min = 54.dp).testTag("use-ready-lesson")) { Icon(Icons.Default.ContentCopy, null); Spacer(Modifier.width(8.dp)); Text("Usar esta aula") }
        }
    }
    if (showText) AlertDialog(onDismissRequest = { showText = false }, title = { Text(detail.getJSONObject("supportText").str("title")) }, text = {
        val text = detail.getJSONObject("supportText")
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            text.arr("paragraphs").strings().forEach { Text(it) }
            Text(text.str("credit"), color = EduMuted, style = MaterialTheme.typography.bodySmall)
        }
    }, confirmButton = { TextButton(onClick = { showText = false }) { Text("Fechar") } })
    if (showEntry) AlertDialog(onDismissRequest = { if (!vm.busy) showEntry = false }, title = { Text("Começar com esta aula") }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Use sua conta ou um acesso temporário sem senha.")
            OutlinedTextField(name, { name = it.take(30) }, label = { Text("Seu nome para acesso temporário") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Text("O acesso temporário dura 30 dias neste aparelho.", color = EduMuted)
        }
    }, confirmButton = { TextButton(onClick = { showEntry = false; vm.temporaryAndUseReadyLesson(name.trim()) }, enabled = !vm.busy && name.trim().length >= 2) { Text("Começar sem senha") } },
        dismissButton = { TextButton(onClick = { showEntry = false; vm.markReadyUse(); onSignIn() }, enabled = !vm.busy) { Text("Usar minha conta") } })
}
