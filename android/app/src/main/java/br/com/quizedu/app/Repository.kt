package br.com.quizedu.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.net.HttpCookie
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlin.math.max
import kotlin.math.roundToInt

class ApiError(val status: Int, override val message: String) : IOException(message)
class SecretStore(context: Context) {
    private val preferences = context.getSharedPreferences("quizedu_secrets", Context.MODE_PRIVATE)
    private val alias = "quizedu.credentials.v1"
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    @Synchronized fun get(name: String): String {
        val value = preferences.getString(name, null) ?: return ""
        return try {
            val parts = value.split(":")
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
            String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8)
        } catch (_: Exception) { preferences.edit().remove(name).apply(); "" }
    }
    @Synchronized fun set(name: String, value: String) {
        if (value.isEmpty()) { preferences.edit().remove(name).commit(); return }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(value.toByteArray()), Base64.NO_WRAP)
        preferences.edit().putString(name, encrypted).commit()
    }
}

interface QuizClient {
    fun clear()
    suspend fun request(path: String, data: JSONObject? = null, method: String = if (data == null) "GET" else "POST"): JSONObject
    suspend fun image(bytes: ByteArray): JSONObject
}
class QuizApi(private val secrets: SecretStore, private val teacher: Boolean) : QuizClient {
    private val cookieKey = if (teacher) "teacher_cookies" else "student_cookies"
    override fun clear() { secrets.set(cookieKey, ""); if (teacher) secrets.set("teacher_token", "") }
    override suspend fun request(path: String, data: JSONObject?, method: String): JSONObject =
        exchange(path, method, data?.toString()?.toByteArray(), "application/json")
    override suspend fun image(bytes: ByteArray): JSONObject = exchange("/api/media", "POST", bytes, "image/jpeg")
    private suspend fun exchange(path: String, method: String, bytes: ByteArray?, contentType: String): JSONObject = withContext(Dispatchers.IO) {
        require(path.startsWith("/api/") && !path.contains("..") && !path.contains("\\"))
        val connection = URL(BuildConfig.SITE_URL + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 12000; connection.readTimeout = 15000
            connection.instanceFollowRedirects = false
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Origin", BuildConfig.SITE_URL)
            connection.setRequestProperty("User-Agent", "QuizEdu-Android/${BuildConfig.VERSION_NAME}")
            val cookies = try { JSONObject(secrets.get(cookieKey).ifEmpty { "{}" }) } catch (_: Exception) { JSONObject() }
            if (cookies.length() > 0) connection.setRequestProperty("Cookie", cookies.keys().asSequence().joinToString("; ") { "$it=${cookies.str(it)}" })
            if (teacher) secrets.get("teacher_token").takeIf { it.isNotEmpty() }?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            if (bytes != null) {
                connection.doOutput = true; connection.setRequestProperty("Content-Type", contentType)
                connection.setFixedLengthStreamingMode(bytes.size); connection.outputStream.use { it.write(bytes) }
            }
            val status = connection.responseCode
            connection.headerFields.filterKeys { it?.equals("Set-Cookie", true) == true }.values.flatten().forEach { header ->
                try { HttpCookie.parse(header).filter { it.name.startsWith("qe_") }.forEach { if (it.maxAge == 0L) cookies.remove(it.name) else cookies.put(it.name, it.value) } } catch (_: Exception) { }
            }
            secrets.set(cookieKey, cookies.toString())
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.use { String(it.readBytes(), Charsets.UTF_8) } ?: ""
            val result = try { JSONObject(raw) } catch (_: Exception) {
                throw ApiError(status, "Não foi possível acessar o QuizEdu. Verifique sua conexão e tente novamente.")
            }
            if (status !in 200..299) throw ApiError(status, result.str("error", "Não foi possível concluir agora."))
            result
        } finally { connection.disconnect() }
    }
}

class QuizRepository(val context: Context, teacherClient: QuizClient? = null, studentClient: QuizClient? = null) {
    val preferences = context.getSharedPreferences("quizedu_preferences", Context.MODE_PRIVATE)
    val secrets = SecretStore(context)
    val teacherApi: QuizClient = teacherClient ?: QuizApi(secrets, true)
    val studentApi: QuizClient = studentClient ?: QuizApi(secrets, false)
    var profile: JSONObject?
        get() = try { preferences.getString("profile", null)?.let(::JSONObject) } catch (_: Exception) { null }
        set(value) { preferences.edit().putString("profile", value?.toString()).commit() }
    private fun accountId(): String = profile?.str("id")?.takeIf { it.matches(Regex("[a-f0-9-]{36}")) } ?: "guest"
    private fun directory(): File = File(context.filesDir, "lessons/${accountId()}").apply { mkdirs() }
    private fun file(id: String): AtomicFile {
        require(id.matches(Regex("[a-f0-9-]{36}")))
        return AtomicFile(File(directory(), "$id.json"))
    }
    @Synchronized fun store(draft: LessonDraft) {
        val atomic = file(draft.id)
        val stream = atomic.startWrite()
        try { stream.write(draft.toJson().toString().toByteArray()); atomic.finishWrite(stream) }
        catch (e: Exception) { atomic.failWrite(stream); throw e }
    }
    @Synchronized fun local(id: String): LessonDraft? = try { LessonDraft.fromJson(JSONObject(file(id).openRead().use { String(it.readBytes()) })) } catch (_: Exception) { null }
    @Synchronized fun localLessons(): List<LessonDraft> = directory().listFiles()?.filter { it.extension == "json" }?.mapNotNull { local(it.nameWithoutExtension) } ?: emptyList()
    @Synchronized fun removeLocal(id: String) { file(id).delete() }
    suspend fun load(id: String): LessonDraft {
        val local = local(id)
        if (local?.dirty == true) return local
        return try {
            val record = teacherApi.request("/api/presentations/$id").getJSONObject("presentation")
            LessonDraft(record.getJSONObject("deck"), record.getInt("revision")).also(::store)
        } catch (e: Exception) { local ?: throw e }
    }
    suspend fun sync(input: LessonDraft): LessonDraft {
        var draft = input
        // A lost save response must be reconciled before reusing the old revision.
        if (draft.pending != null) {
            val pending = draft.pending
            val current = try { teacherApi.request("/api/presentations/${draft.id}").getJSONObject("presentation") }
                catch (e: ApiError) { if (e.status == 404) null else throw e }
            if (current?.str("writeId") == pending.str("writeId")) {
                draft = draft.copy(revision = current!!.getInt("revision"), pending = null, dirty = draft.deck.toString() != pending.getJSONObject("deck").toString())
                store(draft)
                if (!draft.dirty) return draft
            }
        }
        val pending = if (draft.pending?.getJSONObject("deck")?.toString() == draft.deck.toString()) draft.pending!! else
            JSONObject().put("deck", draft.deck).put("revision", draft.revision).put("writeId", uid())
        store(draft.copy(pending = pending, dirty = true))
        val record = teacherApi.request("/api/presentations", pending).getJSONObject("presentation")
        return LessonDraft(record.getJSONObject("deck"), record.getInt("revision")).also(::store)
    }
    suspend fun upload(uri: Uri): String = withContext(Dispatchers.IO) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw IOException("Escolha uma imagem válida.")
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / sample > 1800) sample *= 2
        val original = context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) }
            ?: throw IOException("Não foi possível abrir a imagem.")
        val ratio = (1600f / max(original.width, original.height)).coerceAtMost(1f)
        val scaled = Bitmap.createScaledBitmap(original, (original.width * ratio).roundToInt().coerceAtLeast(1), (original.height * ratio).roundToInt().coerceAtLeast(1), true)
        val flat = Bitmap.createBitmap(scaled.width, scaled.height, Bitmap.Config.ARGB_8888)
        Canvas(flat).apply { drawColor(Color.WHITE); drawBitmap(scaled, 0f, 0f, null) }
        val output = ByteArrayOutputStream()
        var quality = 85
        do { output.reset(); flat.compress(Bitmap.CompressFormat.JPEG, quality, output); quality -= 10 } while (output.size() > 1000000 && quality >= 25)
        if (flat !== scaled) flat.recycle()
        if (scaled !== original) scaled.recycle()
        original.recycle()
        if (output.size() > 1048576) throw IOException("Escolha uma imagem menor.")
        teacherApi.image(output.toByteArray()).str("url")
    }
}
