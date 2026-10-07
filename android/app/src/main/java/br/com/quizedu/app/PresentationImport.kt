package br.com.quizedu.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import kotlin.math.roundToInt

data class PresentationImport(val deck: JSONObject, val assets: List<JSONObject>, val warnings: List<String>, val format: String) {
    companion object {
        fun fromJson(value: JSONObject) = PresentationImport(value.getJSONObject("deck"), value.arr("assets").objects(), value.arr("warnings").strings(), value.str("format"))
    }
}
suspend fun readPresentation(context: Context, api: QuizClient, uri: Uri): PresentationImport = withContext(Dispatchers.IO) {
    val name = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
    } ?: uri.lastPathSegment ?: "apresentacao.pptx"
    val output = ByteArrayOutputStream()
    context.contentResolver.openInputStream(uri)?.use { stream ->
        val chunk = ByteArray(8192)
        while (true) { val size = stream.read(chunk); if (size < 0) break; if (output.size() + size > 15 * 1024 * 1024) throw IOException("Use uma apresentação de até 15 MB."); output.write(chunk, 0, size) }
    } ?: throw IOException("Não foi possível abrir o arquivo.")
    if (!name.endsWith(".pdf", true)) return@withContext PresentationImport.fromJson(api.presentation(output.toByteArray(), name))
    val file = File.createTempFile("presentation-", ".pdf", context.cacheDir)
    try {
        file.writeBytes(output.toByteArray())
        val deck = newDeck().put("title", name.substringBeforeLast('.').take(100).ifBlank { "PDF importado" }).put("slides", JSONArray())
        val assets = mutableListOf<JSONObject>(); var bytes = 0
        ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor -> PdfRenderer(descriptor).use { pdf ->
            if (pdf.pageCount !in 1..150) throw IOException("Use um PDF de 1 a 150 páginas.")
            for (index in 0 until pdf.pageCount) pdf.openPage(index).use { page ->
                val ratio = minOf(1600f / page.width, 900f / page.height)
                val bitmap = Bitmap.createBitmap((page.width * ratio).roundToInt().coerceAtLeast(1), (page.height * ratio).roundToInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
                val image = ByteArrayOutputStream()
                try { Canvas(bitmap).drawColor(Color.WHITE); page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY); bitmap.compress(Bitmap.CompressFormat.JPEG, 83, image) } finally { bitmap.recycle() }
                bytes += image.size(); if (bytes > 12 * 1024 * 1024) throw IOException("As páginas do PDF ultrapassam 12 MB. Divida o arquivo.")
                val id = uid(); val slide = newSlide("blank").put("title", "Página ${index + 1}")
                slide.put("elements", JSONArray().put(newElement("image", "azul").put("x", 0).put("y", 0).put("w", SLIDE_W).put("h", SLIDE_H).put("fit", "contain").put("radius", 0).put("src", "/api/media/$id").put("alt", "Página ${index + 1} do PDF")))
                deck.arr("slides").put(slide); assets.add(JSONObject().put("id", id).put("mime", "image/jpeg").put("data", Base64.encodeToString(image.toByteArray(), Base64.NO_WRAP)))
            }
        } }
        PresentationImport(deck, assets, listOf("PDF: cada página entra como imagem. Você pode adicionar textos, objetos e perguntas. O texto original da página não é editável."), "PDF")
    } catch (error: SecurityException) { throw IOException("Este PDF é protegido por senha. Abra uma cópia sem senha.", error) }
    finally { file.delete() }
}
