"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Clock3, Loader2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { AvatarPicker } from "./avatar-picker";
import { ActionDock } from "./action-dock";
import { StudentOverview } from "./student-overview";
import { DEFAULT_AVATAR } from "@/lib/avatars";
import { Progress } from "@/components/ui/progress";
import { LETTERS, points } from "@/lib/quiz";
import { api, ApiError, Brand, Loading, Notifications, Offline, useClock } from "./shared";
import { StudentSlide } from "./presentation-live";
import { Podium, useRoom } from "./room-shared";
import { useGamePreferences } from "./learning-tools";
import { AnswerOptions, QuestionHeading } from "./question-view";
import { leaveActiveRoom, saveActiveRoom } from "@/lib/player-app";
import { ExitRoomButton, usePlayerManifest } from "./player-app";

type PendingAnswer={meId:string;index:number;option:number};
export function PlayerRoom({code}:{code:string}) {
  const {state,error,refresh}=useRoom(code);const [name,setName]=useState("");const [avatar,setAvatar]=useState(DEFAULT_AVATAR);const [busy,setBusy]=useState(false);const [joinError,setJoinError]=useState("");const [pending,setPending]=useState<PendingAnswer|null>(null);const [retryMessage,setRetryMessage]=useState("");const inFlight=useRef(false);const pendingRef=useRef<PendingAnswer|null>(null);pendingRef.current=pending;const preferences=useGamePreferences();const phase=useRef("");const current=useRef(state);current.current=state;const pendingKey=`qe_answer_${code}`;
  const leaving=useRef(false);
  usePlayerManifest(code,state?.me?.id);
  useEffect(()=>{if(!state||leaving.current)return;try{if(state.status==="closed")leaveActiveRoom(localStorage,code);else if(state.me||state.status==="lobby"||(state.presentation&&state.status==="slide"))saveActiveRoom(localStorage,state);}catch{}},[code,state?.me?.id,state?.status,state?.expiresAt,state?.title]);
  function exit(){leaving.current=true;try{leaveActiveRoom(localStorage,code);}catch{}}
  const seconds=useClock(state?.serverNow||0,state?.endsAt||null,state?.clock);const countdown=useClock(state?.serverNow||0,state?.startsAt||null,state?.clock);
  useEffect(()=>{if(state?.status!=="question"||!state.question)return;for(const src of [state.question.image,...(state.question.optionImages||[])].filter(Boolean)){const image=new Image();image.src=src!;}},[state?.version]);
  function clearPending(){setPending(null);pendingRef.current=null;setRetryMessage("");try{localStorage.removeItem(pendingKey);sessionStorage.removeItem(pendingKey);}catch{}}
  useEffect(()=>{if(!state?.me)return;if(state.status!=="question"||state.me.answered){clearPending();return;}try{const value=JSON.parse(localStorage.getItem(pendingKey)||sessionStorage.getItem(pendingKey)||"null");if(value&&value.meId===state.me.id&&value.index===state.index&&Number.isInteger(value.option)&&value.option>=0&&value.option<4)setPending(value);}catch{}},[state?.me?.id,state?.index,state?.status,state?.me?.answered]);
  useEffect(()=>{if(!state?.me||!["lobby","slide","question","results"].includes(state.status))return;const beat=()=>{if(!document.hidden)void api(`/api/rooms/${code}/heartbeat`,{}).catch(()=>{});};beat();const timer=setInterval(beat,20000);window.addEventListener("online",beat);document.addEventListener("visibilitychange",beat);return()=>{clearInterval(timer);window.removeEventListener("online",beat);document.removeEventListener("visibilitychange",beat);};},[code,state?.me?.id,state?.status]);
  useEffect(()=>{if(!state)return;const key=`${state.status}:${state.index}`;if(phase.current&&phase.current!==key){if(state.status==="results"&&state.me?.roundCorrect)preferences.tone();if(state.status==="finished")preferences.tone(true);}phase.current=key;},[state?.status,state?.index]);
  async function transmit(item:PendingAnswer){
    if(inFlight.current)return;const latest=current.current;if(!latest?.me||latest.me.id!==item.meId||latest.index!==item.index||latest.status!=="question"){clearPending();return;}
    inFlight.current=true;
    try{await api(`/api/rooms/${code}/answer`,{index:item.index,option:item.option});clearPending();await refresh();}
    catch(e){if(e instanceof ApiError&&(e.status===0||e.status>=500)){setRetryMessage("Tentando confirmar no servidor. Mantenha a página aberta.");void refresh().catch(()=>{});}else{clearPending();toast.info((e as Error).message);void refresh().catch(()=>{});}}
    finally{inFlight.current=false;}
  }
  useEffect(()=>{if(!pending)return;void transmit(pending);const retry=()=>{const item=pendingRef.current;if(item)void transmit(item);};const timer=setInterval(retry,1800);window.addEventListener("online",retry);return()=>{clearInterval(timer);window.removeEventListener("online",retry);};},[pending?.meId,pending?.index,pending?.option]);
  async function join(e:React.FormEvent){e.preventDefault();setBusy(true);setJoinError("");try{await api(`/api/rooms/${code}/join`,{name,avatar});await refresh();}catch(e){setJoinError((e as Error).message);}finally{setBusy(false);}}
  function respond(option:number){if(!state?.me||state.me.answered||pending||busy||(!state.untimed&&!seconds)||countdown>0||error)return;const item={meId:state.me.id,index:state.index,option};try{localStorage.setItem(pendingKey,JSON.stringify(item));}catch{}setPending(item);pendingRef.current=item;void transmit(item);}
  if(!state)return <div className="player-shell student-room-shell"><header className="player-topbar"><Brand href={null}/><ExitRoomButton code={code} onExit={exit}/></header>{error?<main className="player-error"><h1>Não foi possível abrir a sala</h1><p>{error}</p><button className="btn btn-primary" onClick={()=>refresh()}>Tentar novamente</button></main>:<Loading label="Abrindo a sala…"/>}<Notifications/></div>;
  const me=state.me;const final=state.status==="finished",closed=state.status==="closed";const canJoin=!me&&!closed&&!final&&(state.status==="lobby"||!!state.presentation&&state.status==="slide");
  return <div className={`player-shell student-room-shell ${final?"player-final":""} ${canJoin?"has-action-dock player-join-shell":""}`} style={{"--read-scale":preferences.scale} as React.CSSProperties}>
    <header className="player-topbar"><Brand href={null}/><ExitRoomButton code={code} onExit={exit}/></header>
    {error&&<Offline text="Reconectando… Aguarde para responder."/>}
    {me&&<StudentOverview state={state}/>}
    {!me&&!closed&&!final&&<main className="join-workspace"><h1>Entrar na sala</h1><p className="join-quiz-title">{state.title}<span>{state.teacher}</span></p>{canJoin?<form id="player-join-form" className="join-form" onSubmit={join}>
      <label htmlFor="player-name">Seu nome ou apelido</label><input id="player-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Como a turma conhece você?" minLength={2} maxLength={24} required autoComplete="nickname"/>
      <AvatarPicker value={avatar} onChange={setAvatar}/>{joinError&&<p className="form-error" role="alert">{joinError}</p>}
    </form>:<div className="join-unavailable"><Clock3 size={28}/><p>{state.presentation?"Aguarde o professor concluir a pergunta para entrar.":"Este quiz já começou. Aguarde a próxima sala."}</p></div>}</main>}
    {me&&state.status==="lobby"&&<main className="student-room-waiting"><Clock3 size={28}/><h2>Você está na sala!</h2><p>{state.presentation?"Aguardando o início da apresentação.":"Aguardando o início do quiz."}</p></main>}
    {me&&state.status==="slide"&&state.presentation&&<StudentSlide state={state}/>}
    {me&&state.status==="question"&&state.question&&<main className="player-live"><div className="player-score-row"><span>PERGUNTA {state.index+1}/{state.total}</span></div>
      {countdown>0?<div className="player-countdown"><span>Prepare-se!</span><strong key={countdown}>{countdown}</strong></div>:<>
        <div className={`player-timer ${!state.untimed&&seconds<=5?"timer-urgent":""}`}><Clock3 size={19}/><b>{state.untimed?"Tempo livre":`${seconds}s`}</b>{!state.untimed&&<Progress value={Math.min(100,seconds/state.question.seconds*100)} aria-label="Tempo restante"/>}</div>
        <QuestionHeading question={state.question}/>
        {me.answered?<div className="answer-sent"><Check size={28}/><h2>Resposta confirmada!</h2>{me.option!==null&&<p>{LETTERS[me.option]} · {state.question.options[me.option]}</p>}</div>:pending?<div className="answer-pending" role="status"><Loader2 size={28} className="spin"/><h2>Confirmando resposta…</h2><p>{LETTERS[pending.option]} · {state.question.options[pending.option]}</p>{retryMessage&&<span>Tentando confirmar com o servidor…</span>}</div>:<AnswerOptions question={state.question} onChoose={respond} disabled={busy||(!state.untimed&&!seconds)||!!error}/>}
        {!me.answered&&!pending&&!state.untimed&&!seconds&&<p className="player-answer-note">Tempo encerrado. Aguarde o resultado.</p>}
      </>}
    </main>}
    {me&&state.status==="results"&&state.question&&<main className="player-results student-room-results">
      <span className={`result-icon ${me.roundCorrect?"result-success":"result-neutral"}`}>{me.roundCorrect?<Check size={28}/>:<X size={28}/>}</span><h2>{me.roundCorrect?"Resposta certa!":me.answered?"Valeu a tentativa!":"Sem resposta nesta rodada"}</h2>
      <p className="player-round-points">+{points(me.roundPoints)}<span>pontos nesta rodada</span></p>
      <div className="player-correct-answer"><span>RESPOSTA CORRETA</span><b>{state.question.options[state.correct!]}</b>{state.question.optionImages?.[state.correct!]&&<img className="reveal-image" src={state.question.optionImages[state.correct!]} alt={state.question.options[state.correct!]}/>} {state.explanation&&<p>{state.explanation}</p>}</div>
      <p className="next-waiting">Aguardando a próxima pergunta.</p>
    </main>}
    {final&&<main className="player-final-workspace student-room-final"><h2>{state.presentation?"Aula concluída":"Quiz concluído"}</h2>{me&&state.total>0&&<p>{me.correctCount} acertos de {state.total} perguntas</p>}{state.total>0&&<Podium players={state.players}/>}</main>}
    {closed&&<main className="player-error"><h2>Sala encerrada</h2><p>Obrigado por participar.</p></main>}
    {canJoin&&<ActionDock className="player-action-dock"><button type="submit" form="player-join-form" className="btn btn-primary join-button" disabled={busy||name.trim().length<2}>{busy?<Loader2 className="spin" size={20}/>:<Zap size={20} fill="currentColor"/>}Entrar na sala</button></ActionDock>}
    <Notifications/>
  </div>;
}
