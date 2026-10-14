package br.com.quizedu.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

const val ANDROID_RELEASES = "https://github.com/emanoelb5-lgtm/QuizEdu/releases"
data class AppUpdate(val version: String, val versionCode: Int, val url: String)

// Only APKs published by this repository's signed distribution workflow qualify.
fun availableUpdate(release: JSONObject, installedCode: Int): AppUpdate? {
    if (release.optBoolean("draft") || release.optBoolean("prerelease")) return null
    val tag = release.str("tag_name")
    val match = Regex("android-v([0-9]+\\.[0-9]+\\.[0-9]+)-build\\.([0-9]+)").matchEntire(tag) ?: return null
    val build = match.groupValues[2].toIntOrNull()?.takeIf { it in 1..2_000_000_000 } ?: return null
    val code = 10000L + build
    if (code <= installedCode || code > Int.MAX_VALUE) return null
    val version = match.groupValues[1]
    val expected = "$ANDROID_RELEASES/download/$tag/Prativerso-Android-$version.apk"
    if (release.arr("assets").objects().none { it.str("browser_download_url") == expected && it.str("state") == "uploaded" && it.optLong("size") > 0 }) return null
    return AppUpdate(version, code.toInt(), expected)
}

suspend fun latestAppUpdate(): AppUpdate? = withContext(Dispatchers.IO) {
    if (BuildConfig.PLAY_DISTRIBUTION) return@withContext null
    val connection = URL("https://api.github.com/repos/emanoelb5-lgtm/QuizEdu/releases/latest").openConnection() as HttpURLConnection
    try {
        connection.connectTimeout = 7000; connection.readTimeout = 7000
        connection.instanceFollowRedirects = false
        connection.setRequestProperty("Accept", "application/vnd.github+json")
        connection.setRequestProperty("User-Agent", "Prativerso-Android/${BuildConfig.VERSION_NAME}")
        if (connection.responseCode != 200) throw IOException("Não foi possível verificar a atualização agora.")
        val bytes = connection.inputStream.use { input ->
            val output = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(4096)
            while (true) {
                val count = input.read(buffer); if (count == -1) break
                if (output.size() + count > 256 * 1024) throw IOException("Resposta de atualização inválida.")
                output.write(buffer, 0, count)
            }
            output.toByteArray()
        }
        availableUpdate(JSONObject(String(bytes, Charsets.UTF_8)), BuildConfig.VERSION_CODE)
    } finally { connection.disconnect() }
}
