package br.com.quizedu.app

import android.app.Application
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

enum class AppScreen { Home, Editor, Room, Devices }
class QuizViewModel(application: Application, val repository: QuizRepository) : AndroidViewModel(application) {
    constructor(application: Application) : this(application, QuizRepository(application))
    var teacher by mutableStateOf(repository.preferences.getBoolean("teacher_mode", false)); private set
    var screen by mutableStateOf(AppScreen.Home); private set
    var busy by mutableStateOf(false); private set
    var message by mutableStateOf<String?>(null); private set
    var profile by mutableStateOf(repository.profile); private set
    var lessons by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var quizzes by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var activeRooms by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var devices by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var libraryOffline by mutableStateOf(false); private set
    var editor by mutableStateOf<LessonDraft?>(null); private set
    var slideIndex by mutableStateOf(0); private set
    var selectedElement by mutableStateOf<String?>(null); private set
    var room by mutableStateOf<RoomSnapshot?>(null); private set
    var currentCode by mutableStateOf(""); private set
    var roomTeacher by mutableStateOf(false); private set
    var roomError by mutableStateOf<String?>(null); private set
    var connected by mutableStateOf(true); private set
    var receivedAt by mutableStateOf(SystemClock.elapsedRealtime()); private set
    var pendingPair by mutableStateOf(repository.preferences.getString("pair_id", "") ?: ""); private set
    var pairExpires by mutableStateOf(repository.preferences.getLong("pair_expires", 0)); private set
    private var lastHeartbeat = 0L
    private var lastFullRoom = 0L
    val slide: JSONObject? get() = editor?.deck?.arr("slides")?.optJSONObject(slideIndex)

    init {
        if (teacher && profile != null) refreshLibrary()
        val code = repository.preferences.getString(if (teacher) "teacher_room" else "student_room", "") ?: ""
        if (code.matches(Regex("[0-9]{6}"))) openRoom(code, teacher)
    }
    fun notify(text: String) { message = text }
    fun clearMessage() { message = null }
    private fun perform(work: suspend () -> Unit) {
        if (busy) return
        viewModelScope.launch {
            busy = true
            try { work() }
            catch (e: Exception) { message = e.message ?: "Não foi possível concluir. Sua edição foi preservada." }
            finally { busy = false }
        }
    }
    fun mode(educator: Boolean) {
        if (busy) return
        teacher = educator; repository.preferences.edit().putBoolean("teacher_mode", educator).apply()
        screen = AppScreen.Home; room = null; currentCode = ""; roomError = null
        if (educator && profile != null) refreshLibrary()
    }
    fun home() { if (busy) return; screen = AppScreen.Home; currentCode = ""; room = null; if (teacher && profile != null) refreshLibrary() }
    fun leaveRoom() {
        repository.preferences.edit().remove(if (roomTeacher) "teacher_room" else "student_room").apply()
        home()
    }
    fun acceptLink(value: String) {
        val code = roomCode(value)
        if (code == null) { notify("Leia o QR code de uma sala QuizEdu ou digite o código de 6 números."); return }
        teacher = false; repository.preferences.edit().putBoolean("teacher_mode", false).apply()
        openRoom(code, false)
    }
    fun temporary(name: String) = perform {
        repository.teacherApi.clear()
        val response = repository.teacherApi.request("/api/profile", JSONObject().put("name", name))
        profile = response.getJSONObject("profile"); repository.profile = profile
        loadLibrary()
    }
    fun startPairing() = perform {
        val verifier = randomToken()
        val response = repository.teacherApi.request("/api/native/start", JSONObject().put("challenge", sha256(verifier)).put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}".take(80)))
        repository.secrets.set("pair_verifier", verifier)
        pendingPair = response.str("id"); pairExpires = response.optLong("expiresAt")
        repository.preferences.edit().putString("pair_id", pendingPair).putLong("pair_expires", pairExpires).apply()
    }
    fun cancelPairing() {
        pendingPair = ""; repository.secrets.set("pair_verifier", "")
        repository.preferences.edit().remove("pair_id").remove("pair_expires").apply()
    }
    suspend fun pollPairing() {
        val id = pendingPair; if (id.isBlank() || busy) return
        val verifier = repository.secrets.get("pair_verifier"); if (verifier.isBlank()) { cancelPairing(); return }
        try {
            val response = repository.teacherApi.request("/api/native/status", JSONObject().put("id", id).put("verifier", verifier))
            if (pendingPair != id) return
            if (response.str("status") == "approved") {
                val old = repository.localLessons().filter { it.dirty }
                val oldProfile = profile
                repository.teacherApi.clear(); repository.secrets.set("teacher_token", verifier)
                repository.preferences.edit().putString("device_id", id).apply()
                profile = response.getJSONObject("profile"); repository.profile = profile
                if (oldProfile?.str("id") != profile?.str("id")) old.forEach { repository.store(LessonDraft(duplicateDeck(it.deck), 0, true)) }
                cancelPairing(); notify("Conta vinculada. Suas aulas estão disponíveis aqui.")
                loadLibrary()
            }
        } catch (e: ApiError) { if (e.status in listOf(401, 410)) { cancelPairing(); notify(e.message) } }
        catch (_: IOException) { /* Browser approval can continue while reconnecting. */ }
    }
    fun signOut() {
        if (busy) return
        repository.teacherApi.clear(); repository.profile = null; profile = null
        lessons = emptyList(); quizzes = emptyList(); activeRooms = emptyList(); screen = AppScreen.Home
        repository.preferences.edit().remove("teacher_room").remove("device_id").apply()
    }
    fun refreshLibrary() = perform { loadLibrary() }
    private fun cachedSummaries(): List<JSONObject> = repository.localLessons().map { draft ->
        JSONObject().put("id", draft.id).put("title", draft.deck.str("title")).put("subject", draft.deck.str("subject")).put("topic", draft.deck.str("topic"))
            .put("theme", draft.deck.str("theme")).put("slideCount", draft.deck.arr("slides").length())
            .put("questionCount", draft.deck.arr("slides").objects().count { it.str("kind") == "question" }).put("revision", draft.revision).put("localDirty", draft.dirty)
    }
    private suspend fun loadLibrary() {
        if (profile == null) return
        lessons = cachedSummaries()
        try {
            val dashboard = repository.teacherApi.request("/api/dashboard")
            if (dashboard.optJSONObject("profile") == null) throw ApiError(401, "Vincule novamente sua conta ou crie um acesso temporário.")
            profile = dashboard.getJSONObject("profile"); repository.profile = profile
            quizzes = dashboard.arr("quizzes").objects(); activeRooms = dashboard.arr("rooms").objects()
            val remote = repository.teacherApi.request("/api/presentations").arr("presentations").objects()
            val dirty = cachedSummaries().filter { it.optBoolean("localDirty") }
            lessons = dirty + remote.filter { server -> dirty.none { it.str("id") == server.str("id") } }
            libraryOffline = false
        } catch (e: Exception) {
            libraryOffline = true
            if (e is ApiError && e.status == 401) notify(e.message)
            else notify("Sem conexão agora. As aulas já abertas e os rascunhos deste aparelho continuam disponíveis.")
        }
    }
    fun newLesson() {
        if (busy || profile == null) return
        val draft = LessonDraft(newDeck(), 0, true); repository.store(draft)
        editor = draft; slideIndex = 0; selectedElement = null; screen = AppScreen.Editor
    }
    fun editLesson(id: String) = perform {
        editor = repository.load(id); slideIndex = 0; selectedElement = null; screen = AppScreen.Editor
    }
    fun closeEditor() { if (busy) return; editor = null; home() }
    fun selectSlide(index: Int) {
        if (busy) return
        slideIndex = index.coerceIn(0, (editor?.deck?.arr("slides")?.length() ?: 1) - 1); selectedElement = null
    }
    fun selectElement(id: String?) { selectedElement = id }
    fun changeDeck(change: (JSONObject) -> Unit) {
        if (busy) return
        val old = editor ?: return; val deck = old.deck.copy(); change(deck)
        editor = old.copy(deck = deck, dirty = true); repository.store(editor!!)
    }
    fun changeSlide(change: (JSONObject) -> Unit) = changeDeck { change(it.arr("slides").getJSONObject(slideIndex)) }
    fun changeElement(id: String, allowLocked: Boolean = false, change: (JSONObject) -> JSONObject) = changeSlide { slide ->
        slide.put("elements", jsonArray(slide.arr("elements").objects().map { e -> if (e.str("id") == id && (allowLocked || !e.optBoolean("locked"))) change(e) else e }))
    }
    fun moveElement(id: String, dx: Float, dy: Float) = changeElement(id) { e -> boundedGeometry(e, e.optDouble("x").toFloat() + dx, e.optDouble("y").toFloat() + dy) }
    fun addElement(type: String) {
        if ((slide?.arr("elements")?.length() ?: 0) >= 60) { notify("Este slide já tem 60 objetos."); return }
        val e = newElement(type, editor?.deck?.str("theme") ?: "azul")
        changeSlide { it.arr("elements").put(e) }; selectedElement = e.str("id")
    }
    fun addSlide(layout: String) {
        val deck = editor?.deck ?: return
        if (deck.arr("slides").length() >= 150) { notify("Esta aula já tem 150 slides."); return }
        if (layout in listOf("question", "true_false") && deck.arr("slides").objects().count { it.str("kind") == "question" } >= 50) { notify("Esta aula já tem 50 perguntas."); return }
        val index = slideIndex + 1
        changeDeck { d -> val all = d.arr("slides").objects().toMutableList(); all.add(index, newSlide(layout, d.str("theme"))); d.put("slides", jsonArray(all)) }
        selectSlide(index)
    }
    fun duplicateCurrentSlide() {
        val source = slide ?: return
        if ((editor?.deck?.arr("slides")?.length() ?: 150) >= 150) { notify("Use até 150 slides."); return }
        if (source.str("kind") == "question" && editor!!.deck.arr("slides").objects().count { it.str("kind") == "question" } >= 50) { notify("Use até 50 perguntas."); return }
        val index = slideIndex + 1
        changeDeck { val all = it.arr("slides").objects().toMutableList(); all.add(index, duplicateSlide(source)); it.put("slides", jsonArray(all)) }; selectSlide(index)
    }
    fun reorderSlide(delta: Int) {
        val index = slideIndex; val target = index + delta; val count = editor?.deck?.arr("slides")?.length() ?: 0
        if (target !in 0 until count) return
        changeDeck { val all = it.arr("slides").objects().toMutableList(); val item = all.removeAt(index); all.add(target, item); it.put("slides", jsonArray(all)) }; selectSlide(target)
    }
    fun deleteCurrentSlide() {
        val count = editor?.deck?.arr("slides")?.length() ?: 0
        if (count <= 1) { notify("Mantenha pelo menos um slide."); return }
        changeDeck { val all = it.arr("slides").objects().toMutableList(); all.removeAt(slideIndex); it.put("slides", jsonArray(all)) }; selectSlide(slideIndex.coerceAtMost(count - 2))
    }
    fun copyLesson() {
        val old = editor ?: return
        editor = LessonDraft(duplicateDeck(old.deck), 0, true); repository.store(editor!!); notify("Cópia criada neste aparelho. Salve para sincronizar com a conta.")
    }
    fun loadCloudVersion() = perform {
        val id = editor?.id ?: return@perform
        val current = repository.teacherApi.request("/api/presentations/$id").getJSONObject("presentation")
        editor = LessonDraft(current.getJSONObject("deck"), current.getInt("revision")); repository.store(editor!!)
        slideIndex = slideIndex.coerceAtMost(editor!!.deck.arr("slides").length() - 1); selectedElement = null; notify("Versão da conta aberta.")
    }
    fun saveLesson() = perform { syncEditor(); notify("Aula salva na sua conta.") }
    private suspend fun syncEditor() {
        val draft = editor ?: return
        try { editor = repository.sync(draft) }
        catch (e: Exception) { editor = repository.local(draft.id) ?: draft; throw e }
    }
    fun presentLesson() = perform {
        val draft = editor ?: return@perform
        validateLesson(draft.deck)?.let { throw IOException(it) }
        if (draft.dirty || draft.revision == 0) syncEditor()
        val result = repository.teacherApi.request("/api/rooms", JSONObject().put("presentationId", draft.id))
        openRoom(result.str("code"), true)
    }
    fun presentQuiz(id: String) = perform {
        val result = repository.teacherApi.request("/api/rooms", JSONObject().put("quizId", id))
        openRoom(result.str("code"), true)
    }
    fun deleteLesson(id: String, revision: Int) = perform {
        if (revision > 0) repository.teacherApi.request("/api/presentations/$id", JSONObject().put("revision", revision), "DELETE")
        repository.removeLocal(id); loadLibrary(); notify("Aula excluída.")
    }
    fun uploadImage(uri: Uri, elementId: String? = null, question: Boolean = false, background: Boolean = false) = perform {
        val path = repository.upload(uri)
        // Changes are applied after the upload without discarding the current deck.
        busy = false
        when {
            background -> changeSlide { it.getJSONObject("background").put("image", path) }
            question -> changeSlide { it.getJSONObject("question").put("image", path).put("imageAlt", "Imagem da pergunta") }
            elementId != null -> changeElement(elementId) { it.put("src", path) }
        }
        busy = true; notify("Imagem adicionada. Salve a aula para sincronizar.")
    }
    fun openRoom(code: String, asTeacher: Boolean) {
        currentCode = code; roomTeacher = asTeacher; room = null; screen = AppScreen.Room; roomError = null; connected = true; lastHeartbeat = 0; lastFullRoom = 0
        repository.preferences.edit().putString(if (asTeacher) "teacher_room" else "student_room", code).apply()
    }
    suspend fun refreshRoom(force: Boolean = false): Boolean {
        val code = currentCode; if (code.isBlank() || screen != AppScreen.Room) return true
        val client = if (roomTeacher) repository.teacherApi else repository.studentApi
        try {
            val previous = room
            val full = force || SystemClock.elapsedRealtime() - lastFullRoom > 20000
            val query = if (full) "" else previous?.version?.takeIf { it.isNotEmpty() }?.let { "?since=${Uri.encode(it)}" } ?: ""
            val raw = client.request("/api/rooms/$code$query")
            if (code != currentCode || screen != AppScreen.Room) return true
            room = if (raw.optBoolean("pulse") && previous != null) previous.pulse(raw) else RoomSnapshot(raw)
            if (!raw.optBoolean("pulse")) lastFullRoom = SystemClock.elapsedRealtime()
            receivedAt = SystemClock.elapsedRealtime(); connected = true; roomError = null
            if (roomTeacher && room?.isHost != true) roomError = "Esta sala pertence a outra conta. Vincule a conta usada no computador."
            if (room?.status == "closed") repository.preferences.edit().remove(if (roomTeacher) "teacher_room" else "student_room").apply()
            if (SystemClock.elapsedRealtime() - lastHeartbeat > 20000 && (roomTeacher || room?.me != null)) {
                client.request("/api/rooms/$code/heartbeat", JSONObject()); lastHeartbeat = SystemClock.elapsedRealtime()
            }
            return true
        } catch (e: Exception) {
            if (code != currentCode) return true
            connected = false
            if (e is ApiError && e.status in listOf(401, 403, 404, 410)) roomError = e.message
            else if (room == null) roomError = "Não foi possível conectar. Confira a internet e tente novamente."
            return false
        }
    }
    fun join(name: String, avatar: String) = perform {
        repository.studentApi.request("/api/rooms/$currentCode/join", JSONObject().put("name", name).put("avatar", avatar))
        repository.preferences.edit().putString("student_name", name).putString("student_avatar", avatar).apply()
        room = null; refreshRoom()
    }
    fun answer(option: Int) = perform {
        val snapshot = room ?: return@perform
        try { repository.studentApi.request("/api/rooms/${snapshot.code}/answer", JSONObject().put("index", snapshot.index).put("option", option)) }
        finally { refreshRoom(force = true) }
    }
    fun control(action: String, target: Int? = null, playerId: String? = null) = perform {
        val snapshot = room ?: return@perform
        if (!snapshot.isHost) throw IOException("Apenas o professor da sala pode controlá-la.")
        val command = snapshot.command(action)
        target?.let { command.put("targetSlide", it) }; playerId?.let { command.put("playerId", it) }
        if (action == "blackout") command.put("blackout", !(snapshot.presentation?.optBoolean("blackout") ?: false))
        try {
            val result = repository.teacherApi.request("/api/rooms/${snapshot.code}/control", command)
            if (result.str("code") == currentCode) { room = RoomSnapshot(result); receivedAt = SystemClock.elapsedRealtime() }
            else refreshRoom()
        } catch (e: ApiError) {
            if (e.status == 409) { refreshRoom(force = true); throw IOException("A apresentação mudou em outra tela. O controle foi atualizado.") }
            if (e.status in listOf(401, 403)) { roomError = e.message; connected = false }
            throw e
        }
    }
    fun showDevices() = perform { devices = repository.teacherApi.request("/api/native/devices").arr("devices").objects(); screen = AppScreen.Devices }
    fun revokeDevice(id: String) = perform {
        repository.teacherApi.request("/api/native/devices/$id", JSONObject(), "DELETE")
        if (id == repository.preferences.getString("device_id", "")) { busy = false; signOut(); busy = true }
        else devices = repository.teacherApi.request("/api/native/devices").arr("devices").objects()
        notify("Acesso do aparelho revogado.")
    }
}
