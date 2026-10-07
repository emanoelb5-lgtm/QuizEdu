package br.com.quizedu.app
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import org.json.JSONObject

@Composable fun ExpandedTextEditor(element: JSONObject, onClose: () -> Unit, onSave: (JSONObject) -> Unit) {
    var doc by remember(element.str("id")) { mutableStateOf(element.optJSONObject("doc")?.copy() ?: richText("")) }
    var value by remember(element.str("id")) { mutableStateOf(TextFieldValue(plainText(doc))) }
    var link by remember { mutableStateOf("") }
    var linkOpen by remember { mutableStateOf(false) }
    fun format(type: String, attrs: JSONObject? = null) { doc = formatStyledText(doc, value.selection.start, value.selection.end, type, attrs) }
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxWidth().fillMaxHeight(.94f).padding(10.dp), shape = MaterialTheme.shapes.large) {
            Column(Modifier.padding(18.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Editar texto", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Selecione um trecho para formatar. Sem seleção, a formatação vale para todo o texto.", style = MaterialTheme.typography.bodySmall, color = EduMuted)
                Row { TextButton(onClick = { format("bold") }) { Text("Negrito", fontWeight = FontWeight.Bold) }; TextButton(onClick = { format("italic") }) { Text("Itálico") }; TextButton(onClick = { format("underline") }) { Text("Sublinhar") } }
                Row { TextButton(onClick = { format("strike") }) { Text("Tachar") }; TextButton(onClick = { linkOpen = !linkOpen }) { Text("Link") } }
                if (linkOpen) { OutlinedTextField(link, { link = it }, label = { Text("Endereço https://") }, modifier = Modifier.fillMaxWidth()); TextButton(onClick = { if (link.startsWith("https://") || link.startsWith("http://")) { format("link", JSONObject().put("href", link.take(1500))); linkOpen = false } }) { Text("Aplicar link à seleção") } }
                ColorField("Cor da seleção", element.str("color", "#15203d")) { color -> format("textStyle", JSONObject().put("color", color)) }
                OutlinedTextField(value, { next -> if (next.text.length <= 16000) { if (next.text != value.text) doc = replaceStyledText(doc, next.text); value = next } }, label = { Text("Conteúdo do texto") }, modifier = Modifier.fillMaxWidth().heightIn(min = 180.dp), minLines = 6, maxLines = 12)
                Text(annotatedRichText(doc, 1f, 18f), modifier = Modifier.fillMaxWidth(), style = MaterialTheme.typography.bodyLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { OutlinedButton(onClick = onClose, modifier = Modifier.weight(1f)) { Text("Cancelar") }; Button(onClick = { onSave(doc); onClose() }, modifier = Modifier.weight(1f)) { Text("Aplicar") } }
            }
        }
    }
}
