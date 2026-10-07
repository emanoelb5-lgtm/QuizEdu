"use client";
import { AvatarImage } from "./avatar-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, Trophy, Check, X, Medal } from "lucide-react";
import { api } from "./shared";
import { Player, points, RoomState } from "@/lib/quiz";
import { bestClock, clockSample, LiveClock, roomIsOlder } from "@/lib/live-clock";

export function useRoom(code: string) {
  const [state, setState] = useState<RoomState | null>(null); const [error, setError] = useState(""); const ref = useRef<RoomState | null>(null); const lastPresence = useRef(0);
  const clock = useRef<LiveClock | undefined>(undefined); const active = useRef<Promise<unknown> | null>(null); const generation = useRef(0);
  const apply = useCallback((value: RoomState) => { if (ref.current && value.code === ref.current.code && roomIsOlder(value, ref.current)) return; const next = { ...value, clock: clock.current }; ref.current = next; setState(next); }, []);
  const refresh = useCallback(async (full = true) => {
    const epoch = generation.current;
    while (active.current) await active.current.catch(() => {});
    if (epoch !== generation.current) return ref.current;
    let finish!: () => void; const operation = new Promise<void>(resolve => { finish = resolve; }); active.current = operation;
    try {
    const params = new URLSearchParams(); if(!full&&ref.current)params.set("since",ref.current.version);
    if(ref.current?.isHost&&Date.now()-lastPresence.current>10000){params.set("presence","1");lastPresence.current=Date.now();}
    const suffix = params.size?`?${params}`:"";
    const sent = performance.now();
    const data = await api<RoomState & { pulse?: boolean }>(`/api/rooms/${code}${suffix}`);
    if (epoch !== generation.current) return ref.current;
    if (!clock.current) clock.current = clockSample(data.serverNow, sent, performance.now());
    if (data.pulse && ref.current) { if (data.version === ref.current.version) apply({ ...ref.current, serverNow: data.serverNow, answeredCount: data.answeredCount, ...(data.presence?{presence:data.presence}: {}) }); } else apply(data);
    setError(""); return ref.current;
    } finally { if (active.current === operation) active.current = null; finish(); }
  }, [code, apply]);
  useEffect(() => {
    generation.current++; active.current = null; ref.current = null; clock.current = undefined; setState(null); setError("");
    let alive = true, liveAt = 0, requested = false, working = false; let events: EventSource | undefined;
    async function update() {
      requested = true; if (working) return; working = true;
      try { while (alive && requested) { requested = false; try { await refresh(false); } catch (e) { if (alive) setError((e as Error).message); } } } finally { working = false; }
    }
    async function syncClock() {
      const sent = performance.now();
      try { const pong = await api<{serverNow:number}>("/api/ping"); if (!alive) return; clock.current = bestClock(clock.current, clockSample(pong.serverNow, sent, performance.now())); if (ref.current) apply(ref.current); } catch { /* Room requests continue if a clock sample is lost. */ }
    }
    if (typeof EventSource !== "undefined") {
      events = new EventSource(`/api/rooms/${code}/events`);
      events.addEventListener("sync", event => {
        if (!alive) return;
        try { const signal = JSON.parse((event as MessageEvent).data); liveAt = performance.now();
          if (!ref.current || signal.version !== ref.current.version) void update();
          else apply({ ...ref.current, serverNow: signal.serverNow, answeredCount: signal.answeredCount });
          if (signal.status === "closed" || signal.status === "finished") events?.close();
        } catch { liveAt = 0; }
      });
    }
    void update(); void syncClock();
    const fallback = setInterval(() => { if (!alive || ref.current?.status === "closed" || ref.current?.status === "finished") return; if (performance.now() - liveAt > 2500 || (ref.current?.isHost && Date.now() - lastPresence.current > 10000)) void update(); }, 500);
    const clockTimer = setInterval(syncClock, 10000);
    const visible = () => { if (!document.hidden) { liveAt = 0; void update(); void syncClock(); } };
    document.addEventListener("visibilitychange", visible); window.addEventListener("online", visible);
    return () => { alive = false; generation.current++; events?.close(); clearInterval(fallback); clearInterval(clockTimer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", visible); };
  }, [refresh]);
  return { state, error, refresh, apply };
}
export function Ranking({ players, me, final = false }: { players: Player[]; me?: string; final?: boolean }) {
  return <ol className={`ranking ${final ? "ranking-final" : ""}`}>{players.map(p => <li key={p.id} className={`${p.id === me ? "ranking-me" : ""} ${p.position <= 3 ? "ranking-top" : ""}`}><span className="rank-position">{p.position === 1 ? <Crown size={22} /> : `${p.position}º`}</span><span className="rank-avatar" aria-hidden="true"><AvatarImage value={p.avatar}/></span><span className="rank-person"><b>{p.name}{p.id === me && <small>Você</small>}</b><span>{p.correctCount} {p.correctCount === 1 ? "acerto" : "acertos"}{!final && p.roundCorrect !== null && <span className={`round-result ${p.roundCorrect ? "result-right" : "result-wrong"}`}>{p.roundCorrect ? <Check size={13} /> : <X size={13} />} {p.roundCorrect ? `+${points(p.roundPoints)}` : "+0"}</span>}</span></span><b className="rank-score">{points(p.score)}<small>pontos</small></b></li>)}</ol>;
}
export function Podium({ players }: { players: Player[] }) {
  return <div className="podium">{players[1] && <div className="podium-place podium-second"><span className="podium-medal"><Medal size={28} /></span><span className="podium-avatar"><AvatarImage value={players[1].avatar}/></span><h2>{players[1].name}</h2><p>{points(players[1].score)} pontos</p><span className="pedestal"><b>2</b><span>SEGUNDO LUGAR</span></span></div>}{players[0] && <div className="podium-place podium-first"><span className="podium-medal"><Trophy size={36} /></span><span className="podium-avatar"><AvatarImage value={players[0].avatar}/></span><h2>{players[0].name}</h2><p>{points(players[0].score)} pontos</p><span className="pedestal"><b>1</b><span>PRIMEIRO LUGAR</span></span></div>}</div>;
}
