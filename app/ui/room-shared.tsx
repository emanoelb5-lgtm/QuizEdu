"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, Trophy, Check, X, Medal } from "lucide-react";
import { api } from "./shared";
import { Player, points, RoomState } from "@/lib/quiz";

export function useRoom(code: string) {
  const [state, setState] = useState<RoomState | null>(null); const [error, setError] = useState(""); const ref = useRef<RoomState | null>(null); const lastPresence = useRef(0);
  const apply = useCallback((value: RoomState) => { if (ref.current && (value.index < ref.current.index || value.serverNow < ref.current.serverNow)) return; ref.current = value; setState(value); }, []);
  const refresh = useCallback(async (full = true) => {
    const params = new URLSearchParams(); if(!full&&ref.current)params.set("since",ref.current.version);
    if(ref.current?.isHost&&Date.now()-lastPresence.current>10000){params.set("presence","1");lastPresence.current=Date.now();}
    const suffix = params.size?`?${params}`:"";
    const data = await api<RoomState & { pulse?: boolean }>(`/api/rooms/${code}${suffix}`);
    if (data.pulse && ref.current) { if (data.version === ref.current.version) apply({ ...ref.current, serverNow: data.serverNow, answeredCount: data.answeredCount, ...(data.presence?{presence:data.presence}: {}) }); } else apply(data);
    setError(""); return ref.current;
  }, [code, apply]);
  useEffect(() => {
    let alive = true; let timeout: ReturnType<typeof setTimeout>; let failures = 0;
    async function poll() { try { await refresh(false); failures = 0; } catch (e) { if (alive) setError((e as Error).message); failures++; }
      if (alive && ref.current?.status !== "closed" && ref.current?.status !== "finished") { const wait = failures ? Math.min(10000, 1500 * failures) : document.hidden ? 4000 : ref.current?.status === "question" ? 1000 : 2000; timeout = setTimeout(poll, wait); }
    }
    void poll(); const visible = () => { if (!document.hidden) void refresh(true).catch(() => {}); }; document.addEventListener("visibilitychange", visible); window.addEventListener("online",visible);
    return () => { alive = false; clearTimeout(timeout); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online",visible); };
  }, [refresh]);
  return { state, error, refresh, apply };
}
export function Ranking({ players, me, final = false }: { players: Player[]; me?: string; final?: boolean }) {
  return <ol className={`ranking ${final ? "ranking-final" : ""}`}>{players.map(p => <li key={p.id} className={`${p.id === me ? "ranking-me" : ""} ${p.position <= 3 ? "ranking-top" : ""}`}><span className="rank-position">{p.position === 1 ? <Crown size={22} /> : `${p.position}º`}</span><span className="rank-avatar" aria-hidden="true">{p.avatar}</span><span className="rank-person"><b>{p.name}{p.id === me && <small>Você</small>}</b><span>{p.correctCount} {p.correctCount === 1 ? "acerto" : "acertos"}{!final && p.roundCorrect !== null && <span className={`round-result ${p.roundCorrect ? "result-right" : "result-wrong"}`}>{p.roundCorrect ? <Check size={13} /> : <X size={13} />} {p.roundCorrect ? `+${points(p.roundPoints)}` : "+0"}</span>}</span></span><b className="rank-score">{points(p.score)}<small>pontos</small></b></li>)}</ol>;
}
export function Podium({ players }: { players: Player[] }) {
  return <div className="podium">{players[1] && <div className="podium-place podium-second"><span className="podium-medal"><Medal size={28} /></span><span className="podium-avatar">{players[1].avatar}</span><h2>{players[1].name}</h2><p>{points(players[1].score)} pontos</p><span className="pedestal"><b>2</b><span>SEGUNDO LUGAR</span></span></div>}{players[0] && <div className="podium-place podium-first"><span className="podium-medal"><Trophy size={36} /></span><span className="podium-avatar">{players[0].avatar}</span><h2>{players[0].name}</h2><p>{points(players[0].score)} pontos</p><span className="pedestal"><b>1</b><span>PRIMEIRO LUGAR</span></span></div>}</div>;
}
