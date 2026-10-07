package br.com.quizedu.app

data class LiveClock(val serverNow: Long, val receivedAt: Long, val roundTripMs: Long) {
    fun now(monotonic: Long): Long = serverNow + roundTripMs / 2 + (monotonic - receivedAt).coerceAtLeast(0)
    companion object {
        fun sample(serverNow: Long, sentAt: Long, receivedAt: Long) = LiveClock(serverNow, receivedAt, (receivedAt - sentAt).coerceAtLeast(0))
        fun best(previous: LiveClock?, sample: LiveClock): LiveClock =
            if (previous == null || sample.receivedAt - previous.receivedAt > 30000 || sample.roundTripMs <= previous.roundTripMs + 10) sample else previous
    }
}

fun olderRoom(incoming: RoomSnapshot, current: RoomSnapshot): Boolean {
    if (incoming.raw.has("revision") && current.raw.has("revision") && incoming.raw.optLong("revision") != current.raw.optLong("revision"))
        return incoming.raw.optLong("revision") < current.raw.optLong("revision")
    return incoming.serverNow < current.serverNow
}
