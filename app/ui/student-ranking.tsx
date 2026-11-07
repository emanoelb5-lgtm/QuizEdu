"use client";
import {Trophy} from "lucide-react";
import {points,type RoomState} from "@/lib/quiz";
import {ActionDock} from "./action-dock";
import {AvatarImage} from "./avatar-picker";

export function StudentRanking({state}:{state:RoomState}){
  if(!state.me)return null;
  return <ActionDock className="student-ranking-dock"><section className="student-ranking" aria-label="Ranking da turma ao vivo">
    <header><h2><Trophy size={17}/>Ranking ao vivo</h2><span>Você: <b>{state.me.position>0?`${state.me.position}º lugar`:"na sala"}</b></span></header>
    <ol className="student-ranking-track" tabIndex={0} aria-label="Classificação completa; deslize para ver os participantes">
      {state.players.map(player=><li key={player.id} className={player.id===state.me!.id?"student-ranking-self":""} aria-current={player.id===state.me!.id?"true":undefined}>
        <span className={`student-ranking-position ${player.position<=3?"student-ranking-medal":""}`}>{player.position}º</span><AvatarImage value={player.avatar} size={30}/><div><b title={player.name}>{player.id===state.me!.id?"Você":player.name}</b><span>{points(player.score)} pts</span></div>
      </li>)}
    </ol>
  </section></ActionDock>;
}
