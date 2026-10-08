"use client";
import type { RoomState } from "@/lib/quiz";
import { points } from "@/lib/quiz";
import { AvatarImage } from "./avatar-picker";

export function StudentOverview({state}:{state:RoomState}) {
  const me=state.me;
  if(!me)return null;
  return <section className="student-overview" aria-label="Sua participação">
    <h1>{state.title}</h1>
    <div className="student-overview-row"><div className="student-identity"><AvatarImage value={me.avatar} size={32}/><span>{me.name}</span></div>
      {state.total>0&&<div className="student-current-score"><strong aria-live="polite">{points(me.score)} <span>pontos</span></strong>{state.status!=="lobby"&&me.position>0&&<small>{me.position}º lugar</small>}</div>}
    </div>
  </section>;
}
