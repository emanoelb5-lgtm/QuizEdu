"use client";
import {useEffect,useRef,useState} from "react";
import {Check,Loader2,Vote} from "lucide-react";
import {RoomState} from "@/lib/quiz";
import {api,ApiError,useClock} from "./shared";
import {PollOptions} from "./poll-view";
type PendingVote={playerId:string;index:number;choices:number[]};
export function StudentPoll({state,error,refresh}:{state:RoomState;error:string;refresh:()=>Promise<unknown>}){
  const q=state.question!,poll=state.poll!,key=`qe_poll_${state.code}_${state.index}`;
  const [selected,setSelected]=useState<number[]>([]),[pending,setPending]=useState<PendingVote|null>(null),[sending,setSending]=useState(false),[notice,setNotice]=useState("");
  const current=useRef(state);current.current=state;const inflight=useRef(false);
  const countdown=useClock(state.serverNow,state.startsAt,state.clock),confirmed=poll.myChoices.length>0,closed=state.status!=="question";
  function clear(){setPending(null);try{localStorage.removeItem(key);}catch{}}
  useEffect(()=>{if(confirmed||closed){clear();return;}try{const item=JSON.parse(localStorage.getItem(key)||"null");if(item?.playerId===state.me?.id&&item.index===state.index&&Array.isArray(item.choices))setPending(item);}catch{}},[state.me?.id,state.index,state.status,confirmed]);
  async function transmit(item:PendingVote){
    if(inflight.current)return;const s=current.current;if(s.me?.id!==item.playerId||s.index!==item.index||s.status!=="question"){clear();return;}
    inflight.current=true;setSending(true);
    try{await api(`/api/rooms/${state.code}/vote`,{index:item.index,choices:item.choices});clear();setNotice("Voto confirmado!");await refresh();}
    catch(e){if(e instanceof ApiError&&(e.status===0||e.status>=500)){setNotice("Ainda estamos tentando confirmar seu voto. Não será contado duas vezes.");}else{clear();setNotice((e as Error).message);}void refresh().catch(()=>{});}
    finally{inflight.current=false;setSending(false);}
  }
  useEffect(()=>{if(!pending)return;void transmit(pending);const timer=setInterval(()=>void transmit(pending),1800);return()=>clearInterval(timer);},[pending]);
  function choose(i:number){if(confirmed||closed||pending)return;setSelected(old=>q.allowMultiple?old.includes(i)?old.filter(n=>n!==i):[...old,i]:[i]);}
  function confirm(){if(!selected.length||countdown>0||error)return;const item={playerId:state.me!.id,index:state.index,choices:[...selected].sort((a,b)=>a-b)};try{localStorage.setItem(key,JSON.stringify(item));}catch{}setPending(item);void transmit(item);}
  return <main className="student-poll player-live">
    <span className="poll-kicker"><Vote size={20}/>ENQUETE</span><h1>{q.text}</h1><p>{q.allowMultiple?"Marque uma ou mais opções e confirme seu voto.":"Escolha uma opção e confirme seu voto."}</p>
    {countdown>0&&!closed&&<p role="status">Começa em {countdown}…</p>}
    {q.image&&<img className="poll-question-photo" src={q.image} alt={q.imageAlt||"Imagem da enquete"}/>}
    <PollOptions question={q} results={poll} selected={confirmed?poll.myChoices:pending?.choices||selected} onChoose={closed||confirmed?undefined:choose} disabled={sending||!!pending||!!error||countdown>0}/>
    {confirmed?<div className="poll-vote-confirmed" role="status"><Check size={22}/><b>Voto confirmado!</b>{!poll.revealed&&<span>Aguarde o professor revelar os resultados.</span>}</div>:!closed?<button className="btn btn-primary poll-confirm" disabled={sending||!!error||countdown>0||(!pending&&!selected.length)} onClick={()=>pending?void transmit(pending):confirm()}>{sending?<Loader2 className="spin" size={19}/>:<Check size={19}/>} {pending?"Confirmar novamente":"Confirmar voto"}</button>:<p>Você não enviou um voto nesta enquete.</p>}
    {notice&&!confirmed&&<p role="status">{notice}</p>}
    {poll.revealed&&<p className="poll-percentage-help">{poll.respondents} alunos responderam. {q.allowMultiple?"Cada porcentagem usa esse total; a soma das opções pode passar de 100%.":"As porcentagens usam os alunos que responderam."}</p>}
    {poll.revealed&&state.explanation&&<p className="poll-comment">{state.explanation}</p>}
  </main>;
}
