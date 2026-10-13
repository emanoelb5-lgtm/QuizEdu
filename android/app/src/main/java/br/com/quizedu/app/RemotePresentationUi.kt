package br.com.quizedu.app

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CastConnected
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.json.JSONObject

@Composable fun LivePresentationBanner(presentations: List<JSONObject>, busy: Boolean, onControl: (String) -> Unit) {
    val current = presentations.firstOrNull() ?: return
    var choose by remember { mutableStateOf(false) }
    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp).testTag("live-presentation-banner")) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.CastConnected, null, tint = EduBlue, modifier = Modifier.size(22.dp))
                Text("Apresentação iniciada", fontWeight = FontWeight.Bold, color = EduBlue, style = MaterialTheme.typography.titleMedium)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(current.str("title"), fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text("Sala ${current.str("code")}", color = EduMuted, style = MaterialTheme.typography.bodySmall)
                }
                Button(onClick = { onControl(current.str("code")) }, enabled = !busy,
                    modifier = Modifier.heightIn(min = 48.dp).testTag("control-live-presentation")) { Text("Controlar") }
            }
            if (presentations.size > 1) Box {
                TextButton(onClick = { choose = true }, enabled = !busy) {
                    Text("Outras apresentações (${presentations.size - 1})"); Icon(Icons.Default.ExpandMore, null)
                }
                DropdownMenu(expanded = choose, onDismissRequest = { choose = false }) {
                    presentations.drop(1).forEach { presentation -> DropdownMenuItem(
                        text = { Column { Text(presentation.str("title"), maxLines = 2, overflow = TextOverflow.Ellipsis); Text("Sala ${presentation.str("code")}", style = MaterialTheme.typography.bodySmall) } },
                        onClick = { choose = false; onControl(presentation.str("code")) },
                        modifier = Modifier.testTag("control-presentation-${presentation.str("code")}")) }
                }
            }
        }
    }
}
