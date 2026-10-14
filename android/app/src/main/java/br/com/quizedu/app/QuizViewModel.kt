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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

enum class AppScreen { Home, Editor, Room, Devices, Catalog }
class QuizViewModel(application: Application, val repository: QuizRepository, private val updateChecker: suspend () -> AppUpdate? = ::latestAppUpdate) : AndroidViewModel(application) {
    constructor(application: Application) : this(application, QuizRepository(application))
    var teacher by mutableStateOf(repository.preferences.getBoolean("teacher_mode", false)); private set
    var screen by mutableStateOf(AppScreen.Home); private set
    var busy by mutableStateOf(false); private set
    var message by mutableStateOf<String?>(null); private set
    var profile by mutableStateOf(repository.profile); private set
    var lessons by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var quizzes by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var activeRooms by mutableStateOf<List<JSONObject>>(emptyList()); private set
    private var detectedPresentations by mutableStateOf<List<JSONObject>>(emptyList())
    private var detectedPresentationOwner by mutableStateOf("")
    val livePresentations: List<JSONObject> get() = if (profile?.str("id") == detectedPresentationOwner) detectedPresentations else emptyList()
    private val livePresentationRefresh = Mutex()
    var devices by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var libraryOffline by mutableStateOf(false); private set
    var readyCatalog by mutableStateOf<JSONObject?>(null); private set
    var readyDetail by mutableStateOf<JSONObject?>(null); private set
    var catalogOffline by mutableStateOf(false); private set
    var appUpdate by mutableStateOf<AppUpdate?>(null); private set
    var checkingUpdate by mutableStateOf(false); private set
    private var lastUpdateCheck = 0L
    private var pendingReadyUse = repository.preferences.getString("pending_ready_use", "") ?: ""
    var fullscreen by mutableStateOf(false); private set
    var cloudPending by mutableStateOf<JSONObject?>(try { repository.preferences.getString("cloud_pending", null)?.let(::JSONObject) } catch (_: Exception) { null }); private set
    var cloudNotice by mutableStateOf<String?>(null); private set
    var cloudNoticeError by mutableStateOf(false); private set
    var pollPending by mutableStateOf<JSONObject?>(try { repository.preferences.getString("poll_pending", null)?.let(::JSONObject) } catch (_: Exception) { null }); private set
    var pollNotice by mutableStateOf<String?>(null); private set
    var editor by mutableStateOf<LessonDraft?>(null); private set
    var slideIndex by mutableStateOf(0); private set
    var selectedElement by mutableStateOf<String?>(null); private set
    var selection by mutableStateOf<Set<String>>(emptySet()); private set
    var importError by mutableStateOf<String?>(null); private set
    var importOpening by mutableStateOf(false); private set
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
    var liveClock by mutableStateOf<LiveClock?>(null); private set
    private val roomRefresh = Mutex()
    private var roomGeneration = 0
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
            catch (e: CancellationException) { throw e }
            catch (e: Exception) { message = e.message ?: "Não foi possível concluir. Sua edição foi preservada."; if (pendingImport != null) importError = message }
            finally { busy = false }
        }
    }
    fun mode(educator: Boolean) {
        if (busy) return
        fullscreen = false; teacher = educator; repository.preferences.edit().putBoolean("teacher_mode", educator).apply()
        screen = AppScreen.Home; room = null; currentCode = ""; roomError = null
        if (educator && profile != null) refreshLibrary()
    }
    fun home() { if (busy) return; fullscreen = false; screen = AppScreen.Home; currentCode = ""; room = null; if (teacher && profile != null) refreshLibrary() }
    fun showFullscreen(value: Boolean) { fullscreen = value && roomTeacher && room?.presentation != null }
    fun checkForUpdates(manual: Boolean = false) {
        if (BuildConfig.PLAY_DISTRIBUTION) return
        if (checkingUpdate || (!manual && lastUpdateCheck > 0 && SystemClock.elapsedRealtime() - lastUpdateCheck < 60 * 60 * 1000)) return
        viewModelScope.launch {
            checkingUpdate = true; lastUpdateCheck = SystemClock.elapsedRealtime()
            try { appUpdate = updateChecker(); if (manual && appUpdate == null) notify("Você está usando a versão mais recente disponível.") }
            catch (e: CancellationException) { throw e }
            catch (_: Exception) { if (manual) notify("Não foi possível verificar a atualização. Tente novamente com internet.") }
            finally { checkingUpdate = false }
        }
    }
    fun browseReadyLessons() = perform {
        teacher = true; repository.preferences.edit().putBoolean("teacher_mode", true).apply()
        readyDetail = null; screen = AppScreen.Catalog
        readyCatalog = try {
            repository.teacherApi.request("/api/lessons").also { repository.preferences.edit().putString("ready_catalog", it.toString()).apply(); catalogOffline = false }
        } catch (e: IOException) {
            catalogOffline = true
            repository.preferences.getString("ready_catalog", null)?.let(::JSONObject) ?: throw e
        }
    }
    private suspend fun loadReadyDetail(id: String) {
        require(id.matches(Regex("[a-z0-9-]{1,100}")))
        readyDetail = try {
            repository.teacherApi.request("/api/lessons/$id").also { repository.preferences.edit().putString("ready_lesson_$id", it.toString()).apply(); catalogOffline = false }
        } catch (e: IOException) {
            catalogOffline = true
            repository.preferences.getString("ready_lesson_$id", null)?.let(::JSONObject) ?: throw e
        }
    }
    fun previewReadyLesson(id: String) = perform { loadReadyDetail(id) }
    fun closeReadyDetail() { if (!busy) readyDetail = null }
    fun markReadyUse() {
        pendingReadyUse = readyDetail?.optJSONObject("lesson")?.str("id") ?: ""
        repository.preferences.edit().putString("pending_ready_use", pendingReadyUse).apply()
    }
    private suspend fun copyReadyLesson() {
        if (profile == null) throw IOException("Comece com sua conta ou com um acesso temporário.")
        val source = readyDetail?.optJSONObject("presentation") ?: throw IOException("Abra a aula antes de usar.")
        val deck = duplicateDeck(source).put("title", source.str("title"))
        validateLesson(deck)?.let { throw IOException(it) }
        clearHistory(); editor = LessonDraft(deck, 0, true); repository.store(editor!!)
        slideIndex = 0; selectedElement = null; screen = AppScreen.Editor
        pendingReadyUse = ""; repository.preferences.edit().remove("pending_ready_use").apply()
        // Opening first keeps the local copy and its writeId available if saving loses a response.
        syncEditor(); notify("Sua cópia está pronta para editar e apresentar.")
    }
    fun useReadyLesson() = perform { copyReadyLesson() }
    fun temporaryAndUseReadyLesson(name: String) = perform { createTemporary(name); copyReadyLesson() }
    fun leaveRoom() {
        repository.preferences.edit().remove(if (roomTeacher) "teacher_room" else "student_room").apply()
        home()
    }
    fun acceptLink(value: String) {
        val code = roomCode(value)
        if (code == null) { notify("Leia o QR code de uma sala Prativerso ou digite o código de 6 números."); return }
        teacher = false; repository.preferences.edit().putBoolean("teacher_mode", false).apply()
        openRoom(code, false)
    }
    private suspend fun createTemporary(name: String) {
        repository.teacherApi.clear()
        val response = repository.teacherApi.request("/api/profile", JSONObject().put("name", name))
        profile = response.getJSONObject("profile"); repository.profile = profile
        loadLibrary()
    }
    fun temporary(name: String) = perform { createTemporary(name) }
    fun startPairing() = perform {
        val verifier = randomToken()
        val response = repository.teacherApi.request("/api/native/start", JSONObject().put("challenge", sha256(verifier)).put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}".take(80)))
        repository.secrets.set("pair_verifier", verifier)
        pendingPair = response.str("id"); pairExpires = response.optLong("expiresAt")
        repository.preferences.edit().putString("pair_id", pendingPair).putLong("pair_expires", pairExpires).apply()
    }
    fun cancelPairing() {
        clearPairing(); pendingReadyUse = ""; repository.preferences.edit().remove("pending_ready_use").apply()
    }
    private fun clearPairing() {
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
                clearPairing(); notify("Conta vinculada. Suas aulas estão disponíveis aqui.")
                loadLibrary()
                if (pendingReadyUse.isNotBlank()) {
                    val pendingId = pendingReadyUse
                    perform { loadReadyDetail(pendingId); copyReadyLesson() }
                }
            }
        } catch (e: ApiError) { if (e.status in listOf(401, 410)) { cancelPairing(); notify(e.message) } }
        catch (_: IOException) { /* Browser approval can continue while reconnecting. */ }
    }
    fun deleteAccount(confirmation: String) = perform {
        repository.teacherApi.request("/api/account/delete", JSONObject().put("confirmation", confirmation))
        repository.eraseAccountDrafts()
        editor = null; selectedElement = null; clearHistory(); pendingReadyUse = ""
        currentCode = ""; room = null; roomGeneration++
        clearAccount()
        notify("Conta e dados excluídos do Prativerso.")
    }
    fun deleteParticipation() = perform {
        repository.studentApi.request("/api/rooms/$currentCode/delete-participation", JSONObject().put("confirmation", "EXCLUIR"))
        repository.studentApi.forgetRoom(currentCode); repository.preferences.edit().remove("student_room").remove("student_name").remove("student_avatar").remove("cloud_pending").remove("poll_pending").apply()
        cloudPending = null; pollPending = null; roomGeneration++; currentCode = ""; room = null; screen = AppScreen.Home
        notify("Sua participação foi excluída.")
    }
    fun reportClassroom(message: String) = perform {
        repository.studentApi.request("/api/rooms/$currentCode/report", JSONObject().put("message", message))
        notify("Aviso enviado ao professor de forma privada.")
    }
    fun moderate(action: String, id: String) = perform {
        repository.teacherApi.request("/api/rooms/$currentCode/moderate", JSONObject().put("action", action).put("id", id))
        refreshRoom(force = true)
    }
    fun signOut() { if (!busy) clearAccount() }
    private fun clearAccount() {
        repository.teacherApi.clear(); repository.profile = null; profile = null
        lessons = emptyList(); quizzes = emptyList(); activeRooms = emptyList(); detectedPresentations = emptyList(); detectedPresentationOwner = ""; screen = AppScreen.Home
        repository.preferences.edit().remove("teacher_room").remove("device_id").apply()
    }
    suspend fun refreshLivePresentations() = livePresentationRefresh.withLock {
        val owner = profile?.str("id") ?: run { detectedPresentations = emptyList(); detectedPresentationOwner = ""; return@withLock }
        try {
            val response = repository.teacherApi.request("/api/presentations/active")
            if (profile?.str("id") != owner) return@withLock
            detectedPresentationOwner = owner
            detectedPresentations = if (response.str("ownerId") == owner) controllablePresentationRooms(response.arr("presentations"), response.optLong("serverNow", System.currentTimeMillis())) else emptyList()
        } catch (e: CancellationException) { throw e }
        catch (_: Exception) { if (profile?.str("id") == owner) detectedPresentations = emptyList() }
    }
    fun controlLivePresentation(code: String) {
        if (busy || profile == null || livePresentations.none { it.str("code") == code }) return
        editor?.takeIf { it.dirty }?.let(repository::store)
        teacher = true; repository.preferences.edit().putBoolean("teacher_mode", true).apply()
        openRoom(code, true)
    }
    fun refreshLibrary() = perform { loadLibrary() }
    private fun cachedSummaries(): List<JSONObject> = repository.localLessons().map { draft ->
        JSONObject().put("id", draft.id).put("title", draft.deck.str("title")).put("subject", draft.deck.str("subject")).put("topic", draft.deck.str("topic"))
            .put("theme", draft.deck.str("theme")).put("slideCount", draft.deck.arr("slides").length())
            .put("questionCount", draft.deck.arr("slides").objects().count { it.str("kind") == "question" && it.optJSONObject("question")?.str("kind") != "poll" }).put("pollCount", draft.deck.arr("slides").objects().count { it.str("kind") == "question" && it.optJSONObject("question")?.str("kind") == "poll" }).put("revision", draft.revision).put("localDirty", draft.dirty)
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
    fun useExample(presentation: Boolean) = perform {
        if (profile == null) return@perform
        val data = try {
            repository.teacherApi.request("/api/examples").also { repository.preferences.edit().putString("examples_cache", it.toString()).apply() }
        } catch (e: IOException) {
            val cached = repository.preferences.getString("examples_cache", null) ?: throw e
            JSONObject(cached)
        }
        val source = if (presentation) data.getJSONObject("presentation") else {
            val quiz = data.getJSONObject("quiz")
            newDeck().put("title", quiz.str("title")).put("subject", quiz.str("subject")).put("topic", quiz.str("topic"))
                .put("mode", quiz.str("mode", "speed")).put("untimed", quiz.optBoolean("untimed"))
                .put("slides", jsonArray(quiz.arr("questions").objects().map { q -> newSlide("question", "campo").put("title", q.str("text").take(60)).put("question", q.copy()) })).put("theme", "campo")
        }
        val deck = duplicateDeck(source).put("title", source.str("title"))
        validateLesson(deck)?.let { throw IOException(it) }
        clearHistory()
        editor = LessonDraft(deck, 0, true); repository.store(editor!!)
        slideIndex = 0; selectedElement = null; screen = AppScreen.Editor
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
    fun prepareImport(uri: Uri) = perform {
        importError = null; importOpening = true; importedImages.clear()
        try {
            pendingImport = readPresentation(repository.context, repository.teacherApi, uri)
            applyImport(pendingImport!!.deck.arr("slides").objects().indices.toSet())
        } finally { importOpening = false }
    }
    fun cancelImport() { if (!busy) { pendingImport = null; importedImages.clear() } }
    fun acceptImport(indices: Set<Int>) = perform {
        importOpening = true
        try { applyImport(indices) } finally { importOpening = false }
    }
    private suspend fun applyImport(indices: Set<Int>) {
        val source = pendingImport ?: return; val selected = source.deck.arr("slides").objects().filterIndexed { index, _ -> index in indices }.map(::duplicateSlide)
        if (selected.isEmpty()) throw IOException("Selecione pelo menos um slide.")
        if (selected.size > 150) throw IOException("A aula pode ter até 150 slides.")
        if (selected.count { it.str("kind") == "question" } > 50) throw IOException("Use até 50 perguntas na aula.")
        val used = selected.flatMap { s -> listOf(s.optJSONObject("background")?.str("image") ?: "") + s.arr("elements").objects().map { it.str("src") } }.toSet()
        for (asset in source.assets.filter { "/api/media/${it.str("id")}" in used }) if (!importedImages.containsKey(asset.str("id"))) importedImages[asset.str("id")] = repository.uploadImportImage(asset)
        selected.forEach { s -> s.optJSONObject("background")?.let { bg -> importedImages[bg.str("image").removePrefix("/api/media/")]?.let { bg.put("image", it) } }; s.arr("elements").objects().forEach { e -> importedImages[e.str("src").removePrefix("/api/media/")]?.let { e.put("src", it) } } }
        clearHistory(); editor = LessonDraft(source.deck.copy().put("id", uid()).put("slides", jsonArray(selected)), 0, true); slideIndex = 0
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
    fun uploadImage(uri: Uri, elementId: String? = null, question: Boolean = false, background: Boolean = false, optionIndex: Int? = null) = perform {
        val path = repository.upload(uri)
        // Changes are applied after the upload without discarding the current deck.
        busy = false
        when {
            optionIndex != null -> changeSlide { s -> val q = s.getJSONObject("question"); val photos = q.optJSONArray("optionImages") ?: JSONArray(List(q.arr("options").length()) { "" }); photos.put(optionIndex, path); q.put("optionImages", photos) }
            background -> changeSlide { it.getJSONObject("background").put("image", path) }
            question -> changeSlide { it.getJSONObject("question").put("image", path).put("imageAlt", "Imagem da pergunta") }
            elementId != null -> changeElement(elementId) { it.put("src", path) }
        }
        busy = true; notify("Imagem adicionada. Salve a aula para sincronizar.")
    }
    fun openRoom(code: String, asTeacher: Boolean) {
        roomGeneration++; liveClock = null
        fullscreen = false; cloudNotice = null; pollNotice = null
        currentCode = code; roomTeacher = asTeacher; room = null; screen = AppScreen.Room; roomError = null; connected = true; lastHeartbeat = 0; lastFullRoom = 0
        repository.preferences.edit().putString(if (asTeacher) "teacher_room" else "student_room", code).apply()
    }
    suspend fun refreshRoom(force: Boolean = false): Boolean { return roomRefresh.withLock {
        val code = currentCode; if (code.isBlank() || screen != AppScreen.Room) return true
        val generation = roomGeneration
        val client = if (roomTeacher) repository.teacherApi else repository.studentApi
        try {
            val previous = room
            val full = force || SystemClock.elapsedRealtime() - lastFullRoom > 20000
            val query = if (full) "" else previous?.version?.takeIf { it.isNotEmpty() }?.let { "?since=${Uri.encode(it)}" } ?: ""
            val sent = SystemClock.elapsedRealtime()
            val raw = client.request("/api/rooms/$code$query")
            val received = SystemClock.elapsedRealtime()
            if (code != currentCode || screen != AppScreen.Room || generation != roomGeneration) return true
            val latest = room
            val next = if (raw.optBoolean("pulse")) {
                if (latest == null || raw.str("version") != latest.version) return true
                latest.pulse(raw)
            } else RoomSnapshot(raw)
            if (latest != null && olderRoom(next, latest)) return true
            room = next
            pollPending?.takeIf { it.str("room") == next.code && it.str("player") == next.me?.str("id") }?.let { pending ->
                if (pending.optInt("index", -1) != next.index || next.poll?.arr("myChoices")?.length()?.let { it > 0 } == true || next.status != "question") clearPendingPoll()
            }
            if (liveClock == null) liveClock = LiveClock.sample(raw.optLong("serverNow"), sent, received)
            if (!raw.optBoolean("pulse")) lastFullRoom = SystemClock.elapsedRealtime()
            receivedAt = SystemClock.elapsedRealtime(); connected = true; roomError = null
            if (roomTeacher && room?.isHost != true) roomError = "Esta sala pertence a outra conta. Vincule a conta usada no computador."
            if (room?.status == "closed") repository.preferences.edit().remove(if (roomTeacher) "teacher_room" else "student_room").apply()
            return true
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            if (code != currentCode) return true
            connected = false
            if (e is ApiError && e.status in listOf(401, 403, 404, 410)) roomError = e.message
            else if (room == null) roomError = "Não foi possível conectar. Confira a internet e tente novamente."
            return false
        }
    }
    }
    fun serverTime(monotonic: Long): Long = liveClock?.now(monotonic) ?: (room?.serverNow ?: 0) + (monotonic - receivedAt).coerceAtLeast(0)
    suspend fun observeRoom() = coroutineScope {
        val code = currentCode; val generation = roomGeneration
        val client = if (roomTeacher) repository.teacherApi else repository.studentApi
        val signals = Channel<JSONObject>(Channel.CONFLATED)
        var lastSignal = 0L
        if (client.supportsRoomEvents) launch {
            var failures = 0
            while (isActive && generation == roomGeneration && code == currentCode && room?.status !in listOf("closed", "finished")) {
                try { client.roomEvents(code) { signals.trySend(it) }; failures = 0; delay(100) }
                catch (e: CancellationException) { throw e }
                catch (_: Exception) { lastSignal = 0; failures++; delay((250L * failures).coerceAtMost(2500)) }
            }
        }
        launch {
            for (signal in signals) {
                if (generation != roomGeneration || code != currentCode) break
                lastSignal = SystemClock.elapsedRealtime()
                if (room == null || signal.str("version") != room?.version) refreshRoom(force = true)
                else {
                    room = RoomSnapshot(room!!.raw.copy().put("answeredCount", signal.optInt("answeredCount")).put("serverNow", signal.optLong("serverNow")))
                    connected = true
                }
            }
        }
        launch {
            while (isActive && generation == roomGeneration && code == currentCode) {
                val sent = SystemClock.elapsedRealtime()
                try {
                    val pong = client.request("/api/ping")
                    if (generation == roomGeneration && code == currentCode) liveClock = LiveClock.best(liveClock, LiveClock.sample(pong.optLong("serverNow"), sent, SystemClock.elapsedRealtime()))
                } catch (e: CancellationException) { throw e } catch (_: Exception) {}
                delay(10000)
            }
        }
        // Presence is independent of state updates. A slow heartbeat must never
        // hold up a slide, and teachers do not have a student heartbeat cookie.
        launch {
            while (isActive && generation == roomGeneration && code == currentCode) {
                if (!roomTeacher && room?.me != null) try { client.request("/api/rooms/$code/heartbeat", JSONObject()) }
                catch (e: CancellationException) { throw e } catch (_: Exception) {}
                delay(20000)
            }
        }
        try {
            refreshRoom(force = true)
            while (isActive && generation == roomGeneration && code == currentCode) {
                delay(500)
                if (room?.status !in listOf("closed", "finished") && (SystemClock.elapsedRealtime() - lastSignal > 2500 || SystemClock.elapsedRealtime() - lastFullRoom > 20000)) refreshRoom()
            }
        } finally { signals.close() }
    }
    fun join(name: String, avatar: String) = perform {
        repository.studentApi.request("/api/rooms/$currentCode/join", JSONObject().put("name", name).put("avatar", avatar))
        repository.preferences.edit().putString("student_name", name).putString("student_avatar", avatar).apply()
        room = null; refreshRoom(force = true)
    }
    fun answer(option: Int) = perform {
        val snapshot = room ?: return@perform
        try { repository.studentApi.request("/api/rooms/${snapshot.code}/answer", JSONObject().put("index", snapshot.index).put("option", option)) }
        finally { refreshRoom(force = true) }
    }
    private fun clearPendingPoll() { pollPending = null; repository.preferences.edit().remove("poll_pending").apply() }
    fun votePoll(choices: List<Int>) = perform {
        val state = room ?: return@perform
        val question = state.question ?: return@perform
        val player = state.me?.str("id") ?: return@perform
        if (state.poll == null) return@perform
        val previous = pollPending?.takeIf { it.str("room") == state.code && it.str("player") == player && it.optInt("index", -1) == state.index }
        val selected = if (previous != null) previous.arr("choices").let { a -> (0 until a.length()).map { a.optInt(it, -1) } } else choices
        val sorted = try { validatedPollChoices(question, selected) } catch (e: IllegalArgumentException) { pollNotice = e.message; return@perform }
        if (previous == null && (state.status != "question" || state.poll!!.arr("myChoices").length() > 0)) return@perform
        val pending = previous ?: JSONObject().put("room", state.code).put("player", player).put("index", state.index).put("choices", JSONArray(sorted))
        pollPending = pending; repository.preferences.edit().putString("poll_pending", pending.toString()).commit()
        try {
            repository.studentApi.request("/api/rooms/${state.code}/vote", pending)
            clearPendingPoll(); pollNotice = "Voto confirmado!"
        } catch (e: ApiError) {
            if (e.status != 429 && e.status < 500) clearPendingPoll()
            pollNotice = e.message
        } catch (_: IOException) { pollNotice = "Ainda não foi possível confirmar. Tente novamente: o mesmo voto não será contado duas vezes." }
        finally { refreshRoom(force = true) }
    }
    fun dismissPendingWord() { if (!busy) { cloudPending = null; repository.preferences.edit().remove("cloud_pending").apply(); cloudNotice = null } }
    var acceptedTerms by mutableStateOf(repository.preferences.getBoolean("accepted_terms_20261014", false)); private set
    fun acceptTerms(accepted: Boolean) { acceptedTerms = accepted; repository.preferences.edit().putBoolean("accepted_terms_20261014", accepted).apply() }
    fun sendCloudWord(value: String) = perform {
        if (!acceptedTerms) { cloudNotice = "Leia e aceite os combinados da sala antes de enviar."; return@perform }
        val state = room ?: return@perform
        val cloud = state.wordCloud ?: return@perform
        val player = state.me?.str("id") ?: return@perform
        val previous = cloudPending?.takeIf { it.str("room") == state.code && it.str("player") == player && it.str("slideId") == cloud.str("slideId") }
        val word = previous?.str("word") ?: java.text.Normalizer.normalize(value.trim().replace('’', '\''), java.text.Normalizer.Form.NFC)
        cloudNoticeError = true
        if (word.isBlank() || word.length > 40 || word.any(Char::isWhitespace)) { cloudNotice = "Envie uma palavra por vez, com até 40 caracteres."; return@perform }
        if (previous == null && cloud.arr("words").objects().any { cloudWordKey(it.str("word")) == cloudWordKey(word) }) { cloudNotice = "“$word” já está na nuvem. Tente outra palavra para ganhar 100 pontos."; return@perform }
        if (!vmCanSendCloud(state) && previous == null) { cloudNotice = "A nuvem está pausada. Aguarde o professor continuar."; return@perform }
        val pending = previous ?: JSONObject().put("room", state.code).put("player", player).put("slideId", cloud.str("slideId")).put("word", word).put("writeId", uid())
        cloudPending = pending; repository.preferences.edit().putString("cloud_pending", pending.toString()).commit()
        try {
            val result = repository.studentApi.request("/api/rooms/${state.code}/word", pending)
            cloudPending = null; repository.preferences.edit().remove("cloud_pending").apply()
            cloudNoticeError = false
            cloudNotice = if (result.optBoolean("added")) "“$word” entrou na nuvem! +${result.optInt("pointsAwarded", 100)} pontos." else "“$word” já teve seu envio confirmado. Seus pontos foram preservados."
        } catch (e: ApiError) {
            if (e.status != 429 && e.status < 500) { cloudPending = null; repository.preferences.edit().remove("cloud_pending").apply() }
            cloudNotice = e.message
        } catch (e: IOException) { cloudNotice = "Não foi possível confirmar “$word”. Toque em tentar novamente; o mesmo envio não soma pontos duas vezes." }
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
            if (result.str("code") == currentCode) { val next = RoomSnapshot(result); if (room == null || !olderRoom(next, room!!)) { room = next; receivedAt = SystemClock.elapsedRealtime() } }
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
