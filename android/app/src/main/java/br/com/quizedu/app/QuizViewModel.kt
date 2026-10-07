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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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
    var selection by mutableStateOf<Set<String>>(emptySet()); private set
    var importError by mutableStateOf<String?>(null); private set
    var pendingImport by mutableStateOf<PresentationImport?>(null); private set
    var canUndo by mutableStateOf(false); private set
    var canRedo by mutableStateOf(false); private set
    var canPaste by mutableStateOf(false); private set
    private val undoHistory = mutableListOf<String>()
    private val redoHistory = mutableListOf<String>()
    private var historyTime = 0L
    private var historyKey = ""
    private var clipboard = emptyList<JSONObject>()
    private val importedImages = mutableMapOf<String, String>()
    private fun clearHistory() { undoHistory.clear(); redoHistory.clear(); canUndo = false; canRedo = false; selection = emptySet(); historyKey = "" }
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
            catch (e: Exception) { message = e.message ?: "Não foi possível concluir. Sua edição foi preservada."; if (pendingImport != null) importError = message }
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
        clearHistory()
        val draft = LessonDraft(newDeck(), 0, true); repository.store(draft)
        editor = draft; slideIndex = 0; selectedElement = null; screen = AppScreen.Editor
    }
    fun editLesson(id: String) = perform {
        clearHistory()
        editor = repository.load(id); slideIndex = 0; selectedElement = null; screen = AppScreen.Editor
    }
    fun closeEditor() { if (busy) return; clearHistory(); editor = null; home() }
    fun selectSlide(index: Int) {
        if (busy) return
        slideIndex = index.coerceIn(0, (editor?.deck?.arr("slides")?.length() ?: 1) - 1); selectedElement = null; selection = emptySet(); historyKey = ""
    }
    fun selectElement(id: String?) { selectedElement = id; val group = slide?.arr("elements")?.objects()?.find { it.str("id") == id }?.str("group")
        selection = if (id == null) emptySet() else if (!group.isNullOrBlank()) slide!!.arr("elements").objects().filter { it.str("group") == group }.map { it.str("id") }.toSet() else setOf(id) }
    fun toggleElement(id: String) { selection = if (id in selection) selection - id else selection + id; selectedElement = selection.firstOrNull() }
    fun changeDeck(mergeKey: String = "", change: (JSONObject) -> Unit) {
        if (busy) return
        val old = editor ?: return; val deck = old.deck.copy(); change(deck)
        if (old.deck.toString() == deck.toString()) return
        val now = SystemClock.elapsedRealtime()
        if (mergeKey.isBlank() || mergeKey != historyKey || now - historyTime > 800) {
            undoHistory.add(old.deck.toString()); while (undoHistory.size > 30 || (undoHistory.size > 1 && undoHistory.sumOf { it.length } > 8 * 1024 * 1024)) undoHistory.removeAt(0)
        }
        historyKey = mergeKey; historyTime = now; redoHistory.clear(); canUndo = undoHistory.isNotEmpty(); canRedo = false
        editor = old.copy(deck = deck, dirty = true); repository.store(editor!!)
    }
    fun changeSlide(change: (JSONObject) -> Unit) = changeDeck("slide:$slideIndex") { change(it.arr("slides").getJSONObject(slideIndex)) }
    fun changeElement(id: String, allowLocked: Boolean = false, change: (JSONObject) -> JSONObject) = changeDeck("element:$slideIndex:$id") { deck ->
        val slide = deck.arr("slides").getJSONObject(slideIndex)
        slide.put("elements", jsonArray(slide.arr("elements").objects().map { e -> if (e.str("id") == id && (allowLocked || !e.optBoolean("locked"))) change(e) else e }))
    }
    fun moveElement(id: String, dx: Float, dy: Float) = changeDeck("drag:$slideIndex:${selection.sorted()}") { deck ->
        val slide = deck.arr("slides").getJSONObject(slideIndex); val objects = slide.arr("elements").objects(); val chosen = objects.filter { it.str("id") in (if (id in selection) selection else setOf(id)) && !it.optBoolean("locked") }
        if (chosen.isNotEmpty()) { val x = dx.coerceIn(-chosen.minOf { it.optDouble("x").toFloat() }, SLIDE_W - chosen.maxOf { (it.optDouble("x") + it.optDouble("w")).toFloat() }); val y = dy.coerceIn(-chosen.minOf { it.optDouble("y").toFloat() }, SLIDE_H - chosen.maxOf { (it.optDouble("y") + it.optDouble("h")).toFloat() }); chosen.forEach { it.put("x", it.optDouble("x") + x).put("y", it.optDouble("y") + y) } }
    }
    fun resizeElement(id: String, dx: Float, dy: Float) = changeElement(id) { boundedGeometry(it, it.optDouble("x").toFloat(), it.optDouble("y").toFloat(), it.optDouble("w").toFloat() + dx, it.optDouble("h").toFloat() + dy) }
    fun undo() { if (busy || undoHistory.isEmpty()) return; val old = editor ?: return; redoHistory.add(old.deck.toString()); editor = old.copy(deck = JSONObject(undoHistory.removeAt(undoHistory.lastIndex)), dirty = true); repository.store(editor!!); canUndo = undoHistory.isNotEmpty(); canRedo = true; selectedElement = null; selection = emptySet(); slideIndex = slideIndex.coerceAtMost(editor!!.deck.arr("slides").length() - 1); historyKey = "" }
    fun redo() { if (busy || redoHistory.isEmpty()) return; val old = editor ?: return; undoHistory.add(old.deck.toString()); editor = old.copy(deck = JSONObject(redoHistory.removeAt(redoHistory.lastIndex)), dirty = true); repository.store(editor!!); canUndo = true; canRedo = redoHistory.isNotEmpty(); selectedElement = null; selection = emptySet(); slideIndex = slideIndex.coerceAtMost(editor!!.deck.arr("slides").length() - 1); historyKey = "" }
    fun copyObjects() { clipboard = slide?.arr("elements")?.objects()?.filter { it.str("id") in selection }?.map { it.copy() } ?: emptyList(); canPaste = clipboard.isNotEmpty(); if (canPaste) notify("Objetos copiados. Escolha um slide e toque em colar.") }
    fun pasteObjects() { if (busy || clipboard.isEmpty() || slide?.str("kind") == "question") return; if (slide!!.arr("elements").length() + clipboard.size > 60) { notify("Use até 60 objetos por slide."); return }; val groups = mutableMapOf<String, String>(); val copies = clipboard.map { e -> boundedGeometry(e, e.optDouble("x").toFloat() + 16, e.optDouble("y").toFloat() + 16).put("id", uid()).put("locked", false).also { if (e.has("group")) it.put("group", groups.getOrPut(e.str("group")) { uid() }) } }; changeDeck { deck -> copies.forEach { deck.arr("slides").getJSONObject(slideIndex).arr("elements").put(it) } }; selection = copies.map { it.str("id") }.toSet(); selectedElement = selection.firstOrNull() }
    fun groupSelection() { if (selection.size < 2) return; val group = uid(); changeDeck { deck -> deck.arr("slides").getJSONObject(slideIndex).arr("elements").objects().filter { it.str("id") in selection && !it.optBoolean("locked") }.forEach { it.put("group", group) } } }
    fun ungroupSelection() = changeDeck { deck -> deck.arr("slides").getJSONObject(slideIndex).arr("elements").objects().filter { it.str("id") in selection && !it.optBoolean("locked") }.forEach { it.remove("group") } }
    fun alignSelection(axis: String) = changeDeck { deck ->
        val items = deck.arr("slides").getJSONObject(slideIndex).arr("elements").objects().filter { it.str("id") in selection && !it.optBoolean("locked") }; if (items.isNotEmpty()) {
            val many = items.size > 1; val left = if (many) items.minOf { it.optDouble("x") } else 0.0; val right = if (many) items.maxOf { it.optDouble("x") + it.optDouble("w") } else SLIDE_W.toDouble(); val top = if (many) items.minOf { it.optDouble("y") } else 0.0; val bottom = if (many) items.maxOf { it.optDouble("y") + it.optDouble("h") } else SLIDE_H.toDouble()
            items.forEach { e -> when (axis) { "left" -> e.put("x", left); "center" -> e.put("x", (left + right - e.optDouble("w")) / 2); "right" -> e.put("x", right - e.optDouble("w")); "top" -> e.put("y", top); "middle" -> e.put("y", (top + bottom - e.optDouble("h")) / 2); "bottom" -> e.put("y", bottom - e.optDouble("h")) } }
        }
    }
    fun prepareImport(uri: Uri) = perform { importError = null; pendingImport = readPresentation(repository.context, repository.teacherApi, uri); importedImages.clear() }
    fun cancelImport() { if (!busy) { pendingImport = null; importedImages.clear() } }
    fun acceptImport(indices: Set<Int>) = perform {
        val source = pendingImport ?: return@perform; val selected = source.deck.arr("slides").objects().filterIndexed { index, _ -> index in indices }.map(::duplicateSlide)
        if (selected.isEmpty()) throw IOException("Selecione pelo menos um slide.")
        val existing = editor?.deck; if ((existing?.arr("slides")?.length() ?: 0) + selected.size > 150) throw IOException("A aula pode ter até 150 slides.")
        if ((existing?.arr("slides")?.objects()?.count { it.str("kind") == "question" } ?: 0) + selected.count { it.str("kind") == "question" } > 50) throw IOException("Use até 50 perguntas na aula.")
        val used = selected.flatMap { s -> listOf(s.optJSONObject("background")?.str("image") ?: "") + s.arr("elements").objects().map { it.str("src") } }.toSet()
        for (asset in source.assets.filter { "/api/media/${it.str("id")}" in used }) if (!importedImages.containsKey(asset.str("id"))) importedImages[asset.str("id")] = repository.uploadImportImage(asset)
        selected.forEach { s -> s.optJSONObject("background")?.let { bg -> importedImages[bg.str("image").removePrefix("/api/media/")]?.let { bg.put("image", it) } }; s.arr("elements").objects().forEach { e -> importedImages[e.str("src").removePrefix("/api/media/")]?.let { e.put("src", it) } } }
        if (existing == null) { clearHistory(); editor = LessonDraft(source.deck.copy().put("id", uid()).put("slides", jsonArray(selected)), 0, true); slideIndex = 0 }
        else { val old = editor!!; undoHistory.add(old.deck.toString()); val deck = existing.copy(); val slides = deck.arr("slides").objects().toMutableList(); slides.addAll(slideIndex + 1, selected); deck.put("slides", jsonArray(slides)); editor = old.copy(deck = deck, dirty = true); slideIndex++; canUndo = true; redoHistory.clear(); canRedo = false }
        repository.store(editor!!); selectedElement = null; selection = emptySet(); pendingImport = null; importedImages.clear(); screen = AppScreen.Editor; notify("${selected.size} slides importados. Salve para sincronizar com a conta.")
    }
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
        clearHistory()
        editor = LessonDraft(duplicateDeck(old.deck), 0, true); repository.store(editor!!); notify("Cópia criada neste aparelho. Salve para sincronizar com a conta.")
    }
    fun loadCloudVersion() = perform {
        val id = editor?.id ?: return@perform
        val current = repository.teacherApi.request("/api/presentations/$id").getJSONObject("presentation")
        editor = LessonDraft(current.getJSONObject("deck"), current.getInt("revision")); repository.store(editor!!)
        clearHistory()
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
