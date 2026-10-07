package br.com.quizedu.app

import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import coil.request.ImageRequest

// Adventurer by Lisa Wischofsky / DiceBear, CC BY 4.0. Assets and credit are bundled.
data class AvatarOption(val id: String, val name: String)
val avatarOptions = listOf(
    AvatarOption("adventurer-01", "Alex"),
    AvatarOption("adventurer-02", "Bia"),
    AvatarOption("adventurer-03", "Cris"),
    AvatarOption("adventurer-04", "Dani"),
    AvatarOption("adventurer-05", "Eli"),
    AvatarOption("adventurer-06", "Fran"),
    AvatarOption("adventurer-07", "Gabi"),
    AvatarOption("adventurer-08", "Hugo"),
    AvatarOption("adventurer-09", "Iara"),
    AvatarOption("adventurer-10", "Jô"),
    AvatarOption("adventurer-11", "Kai"),
    AvatarOption("adventurer-12", "Lia"),
    AvatarOption("adventurer-13", "Mika"),
    AvatarOption("adventurer-14", "Nico"),
    AvatarOption("adventurer-15", "Olí"),
    AvatarOption("adventurer-16", "Pati"),
    AvatarOption("adventurer-17", "Ravi"),
    AvatarOption("adventurer-18", "Sam"),
    AvatarOption("adventurer-19", "Téo"),
    AvatarOption("adventurer-20", "Val"),
    AvatarOption("adventurer-21", "Yuri"),
    AvatarOption("adventurer-22", "Zazá"),
    AvatarOption("adventurer-23", "João"),
    AvatarOption("adventurer-24", "Luz")
)
private val legacyAvatars = listOf("🦊", "🐼", "🐸", "🦁", "🐯", "🐨", "🐧", "🦉", "🐝", "🦋", "🐢", "🐙")
fun avatarOption(value: String): AvatarOption = avatarOptions.firstOrNull { it.id == value }
    ?: avatarOptions.getOrElse(legacyAvatars.indexOf(value).coerceAtLeast(0)) { avatarOptions.first() }

@Composable fun PlayerAvatar(value: String, size: Dp = 40.dp) {
    val context = LocalContext.current
    val option = avatarOption(value)
    val image = remember(context, option.id) { ImageRequest.Builder(context)
        .data("file:///android_asset/avatars/${option.id}.svg")
        .decoderFactory(SvgDecoder.Factory()).crossfade(false).build() }
    AsyncImage(image, null, modifier = Modifier.size(size).clip(CircleShape))
}
