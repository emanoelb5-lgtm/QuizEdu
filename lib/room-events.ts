type SignalRow = { status: string; question_index: number; slide_index: number; build_step: number; blackout: number; roster_version: number; answered_count: number; player_count: number; starts_at: number | null; ends_at: number | null; expires_at: number };
const readSignal = "SELECT status,question_index,slide_index,build_step,blackout,roster_version,answered_count,player_count,starts_at,ends_at,expires_at FROM rooms WHERE code = ?";
export const roomVersion = (r: Pick<SignalRow, "status" | "question_index" | "slide_index" | "build_step" | "blackout" | "roster_version">) => `${r.status}:${r.question_index}:${r.slide_index}:${r.build_step}:${r.blackout}:${r.roster_version}`;

// Signals contain public room metadata only. Each connection is bounded to
// fewer than 40 lightweight D1 reads, then reconnects without a polling pause.
// Full state, identity and private teacher notes still use the ordinary API.
export function roomEventStream(request: Request, database: D1Database, code: string) {
  let cancelled = false;
  let wake: (() => void) | undefined;
  const abort = () => { cancelled = true; wake?.(); };
  request.signal.addEventListener("abort", abort, { once: true });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now(); let previous = "", lastSent = 0;
      try {
        controller.enqueue(encoder.encode("retry: 100\n\n"));
        while (!cancelled && Date.now() - started < 6500) {
          let row = await database.prepare(readSignal).bind(code).first<SignalRow>();
          if (!row) break;
          const now = Date.now();
          if (row.status === "question" && ((row.ends_at !== null && row.ends_at <= now) || (row.starts_at !== null && row.starts_at <= now && row.player_count > 0 && row.answered_count >= row.player_count))) {
            await database.prepare("UPDATE rooms SET status = 'results', roster_version = roster_version + 1 WHERE code = ? AND status = 'question' AND (ends_at <= ? OR (starts_at <= ? AND player_count > 0 AND answered_count >= player_count))").bind(code, now, now).run();
            row = await database.prepare(readSignal).bind(code).first<SignalRow>();
            if (!row) break;
          }
          if (row.expires_at <= now) row.status = "closed";
          const version = roomVersion(row), key = `${version}:${row.answered_count}`;
          if (key !== previous || now - lastSent >= 1000) {
            if (cancelled) break;
            if (controller.desiredSize !== null && controller.desiredSize < 0) break;
            controller.enqueue(encoder.encode(`event: sync\ndata: ${JSON.stringify({ version, revision: row.roster_version, status: row.status, answeredCount: row.answered_count, serverNow: now })}\n\n`));
            previous = key; lastSent = now;
          }
          if (row.status === "closed" || row.status === "finished") break;
          await new Promise<void>(resolve => { const timer = setTimeout(() => { wake = undefined; resolve(); }, 200); wake = () => { clearTimeout(timer); wake = undefined; resolve(); }; });
        }
        if (!cancelled) controller.close();
      } catch (error) {
        if (!cancelled) controller.error(error);
      } finally { request.signal.removeEventListener("abort", abort); }
    },
    cancel() { abort(); }
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff" } });
}
