export type LiveClock = { serverNow: number; receivedAt: number; roundTripMs: number };
// Use a monotonic clock so changing the device's date cannot move a round.
// A short ping estimates the remaining server-to-device transit time.
export function clockSample(serverNow: number, sentAt: number, receivedAt: number): LiveClock {
  return { serverNow, receivedAt, roundTripMs: Math.max(0, receivedAt - sentAt) };
}
export function serverTime(clock: LiveClock, now: number) {
  return clock.serverNow + clock.roundTripMs / 2 + Math.max(0, now - clock.receivedAt);
}
export function bestClock(previous: LiveClock | undefined, sample: LiveClock): LiveClock {
  return !previous || sample.receivedAt - previous.receivedAt > 30000 || sample.roundTripMs <= previous.roundTripMs + 10 ? sample : previous;
}
export function roomIsOlder(incoming: { revision?: number; serverNow: number }, current: { revision?: number; serverNow: number }) {
  if (incoming.revision !== undefined && current.revision !== undefined && incoming.revision !== current.revision) return incoming.revision < current.revision;
  return incoming.serverNow < current.serverNow;
}
