"use client";
import {useEffect,useRef,useState} from "react";
import {Trophy,X} from "lucide-react";
import type {RoomState,Player} from "@/lib/quiz";
import {RANKING_SPOTLIGHT_MS,RankingSpotlightSequence,spotlightRemaining,type RankingSpotlight} from "@/lib/presentation-display";
import {Ranking} from "./room-shared";

export function useRoundRanking(state:RoomState){
  const sequence=useRef(new RankingSpotlightSequence());
  const [spotlight,setSpotlight]=useState<RankingSpotlight|null>(null);
  useEffect(()=>{
    const next=sequence.current.observe(state,Date.now());
    if(next!==undefined)setSpotlight(next);
  },[state.code,state.index,state.status,state.presentation?.review,state.presentation?.blackout]);
  useEffect(()=>{
    if(!spotlight)return;
    const timer=setTimeout(()=>setSpotlight(null),spotlightRemaining(spotlight,Date.now()));
    return()=>clearTimeout(timer);
  },[spotlight?.key]);
  function show(){const now=Date.now();setSpotlight({key:`manual:${now}`,endsAt:now+RANKING_SPOTLIGHT_MS});}
  return {spotlight,show,hide:()=>setSpotlight(null)};
}

export function RoundRankingOverlay({players,onClose}:{players:Player[];onClose:()=>void}){
  return <aside className="lesson-ranking-overlay" aria-label="Ranking após a pergunta" style={{animationDuration:`${RANKING_SPOTLIGHT_MS}ms`}}>
    <header><span className="lesson-ranking-cup"><Trophy size={24}/></span><div><h2>Ranking da aula</h2><p>Pontuação acumulada{players.length>5?" · 5 primeiros":""}</p></div><button onClick={onClose} aria-label="Fechar ranking"><X size={18}/></button></header>
    {players.length?<Ranking players={players.slice(0,5)}/>:<p className="lesson-ranking-empty">Os participantes aparecerão aqui.</p>}
    <div className="lesson-ranking-time" aria-hidden="true"><span style={{animationDuration:`${RANKING_SPOTLIGHT_MS}ms`}}/></div>
  </aside>;
}
