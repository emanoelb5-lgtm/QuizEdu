"use client";
import { useEffect, useRef, useState } from "react";
import { DoorOpen, Loader2, QrCode } from "lucide-react";
import { ActiveRoom, initialRoomCode, leaveActiveRoom, readActiveRoom, roomCode, saveActiveRoom } from "@/lib/player-app";
import type { RoomState } from "@/lib/quiz";
import { api, ApiError, Brand, Loading } from "./shared";
import { usePlayerManifest } from "./player-app";
import { QrScanner } from "./qr-scanner";
import { ActionDock } from "./action-dock";

export function PlayerHome() {
  const [code,setCode]=useState("");const [busy,setBusy]=useState(false);const [restoring,setRestoring]=useState(true);const [error,setError]=useState("");const [active,setActive]=useState<ActiveRoom|null>(null);const [scanner,setScanner]=useState(false);
  const initial=useRef<{code:string;ticket:string;skip:boolean}|null>(null);
  usePlayerManifest(active?.code);
  useEffect(()=>{
    let alive=true;
    if(!initial.current){const url=new URL(window.location.href);initial.current={code:url.searchParams.get("sala")||"",ticket:new URLSearchParams(url.hash.slice(1)).get("retomar")||"",skip:url.searchParams.get("trocar")==="1"};if(url.hash){url.hash="";window.history.replaceState(null,"",url.pathname+url.search);}}
    const startup=initial.current;
    async function restore(){
      let saved:ActiveRoom|null=null;try{saved=readActiveRoom(localStorage);}catch{}if(alive)setActive(saved);
      let candidate:string|null=null;try{candidate=initialRoomCode(localStorage,startup.code);}catch{candidate=/^\d{6}$/.test(startup.code)?startup.code:null;}
      if(startup.skip || !candidate){if(alive)setRestoring(false);return;}
      try{
        if(startup.ticket && candidate===startup.code)await api(`/api/rooms/${candidate}/resume`,{ticket:startup.ticket});
        const room=await api<RoomState>(`/api/rooms/${candidate}`);
        if(!alive)return;
        if(room.status==="closed"){try{leaveActiveRoom(localStorage,candidate);}catch{}setActive(null);setError("A sala anterior foi encerrada. Entre com o código da próxima atividade.");}
        else if(room.me || room.status==="lobby" || (room.presentation&&room.status==="slide")){try{saveActiveRoom(localStorage,room);}catch{}window.location.replace(`/participar/${candidate}`);return;}
        else{setCode(candidate);setError("Para retomar seu participante, abra o Prativerso no navegador em que você entrou na sala.");}
      }catch(reason){if(!alive)return;const failure=reason as ApiError;setError(failure.status===0||failure.status>=500?"Sem conexão no momento. Sua sala continua guardada; tente retomá-la quando a internet voltar.":failure.message);if(failure.status===404||failure.status===409){try{leaveActiveRoom(localStorage,candidate);}catch{}setActive(null);}}
      if(alive)setRestoring(false);
    }
    void restore();return()=>{alive=false;};
  },[]);
  async function enter(value:string){
    const parsed=roomCode(value,window.location.origin);if(!parsed){setError("Digite os 6 números da sala.");return;}
    setBusy(true);setError("");
    try{const room=await api<RoomState>(`/api/rooms/${parsed}`);if(room.status==="closed")throw new Error("Esta sala foi encerrada. Peça ao professor um novo código.");if(!room.me&&room.status!=="lobby"&&!(room.presentation&&room.status==="slide"))throw new Error("Esta partida já começou. Aguarde o professor abrir outra sala.");try{saveActiveRoom(localStorage,room);}catch{}window.location.assign(`/participar/${parsed}`);}catch(reason){setError((reason as Error).message);setBusy(false);}
  }
  function forget(){try{leaveActiveRoom(localStorage);}catch{}setActive(null);setError("");}
  return <div className={`player-shell ${restoring?"":"has-action-dock"}`}><header className="player-topbar"><Brand href="/jogar"/><a className="player-teacher-link" href="/">Sou educador</a></header>
    {restoring?<Loading label="Retomando sua sala…"/>:<main className="player-home"><span className="badge badge-blue">QUIZEDU NO CELULAR</span><h1>Entre no jogo<span>!</span></h1><p>Use o código ou o QR code do professor.</p>
      {active&&<aside className="player-resume-card"><DoorOpen size={24}/><div><b>{active.title}</b><span>Sala {active.code}</span></div><button className="btn btn-primary" disabled={busy} onClick={()=>enter(active.code)}>Retomar</button><button className="btn btn-quiet" onClick={forget}>Sair dessa sala</button></aside>}
      <form id="player-code-form" className="form-stack player-code-form" onSubmit={event=>{event.preventDefault();void enter(code);}}><label htmlFor="app-room-code">Código da sala</label><input className="code-input" id="app-room-code" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} required/></form>

      {error&&<p className="form-error player-home-error" role="alert">{error}</p>}
    </main>}
    {!restoring&&<ActionDock className="player-home-action-dock"><button type="submit" form="player-code-form" className="btn btn-primary" disabled={busy||code.length!==6}>{busy?<Loader2 size={19} className="spin"/>:<DoorOpen size={19}/>}Entrar na sala</button><button className="btn btn-outline" disabled={busy} onClick={()=>{setError("");setScanner(true);}}><QrCode size={21}/>Ler QR code</button></ActionDock>}
    <QrScanner open={scanner} onClose={()=>setScanner(false)} onCode={value=>{setScanner(false);setCode(value);void enter(value);}}/>
  </div>;
}
