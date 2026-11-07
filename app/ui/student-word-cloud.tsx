"use client";
import {useEffect,useRef,useState} from "react";
import {Check,Cloud,Loader2,Send,Sparkles} from "lucide-react";
import type {RoomState} from "@/lib/quiz";
import {cloudWord,MAX_CLOUD_WORD_LENGTH} from "@/lib/word-cloud";
import {api,ApiError} from "./shared";

type Pending={word:string;writeId:string;slideId:string};
export function StudentWordCloud({state,error,refresh}:{state:RoomState;error:string;refresh:()=>Promise<unknown>}){
  const cloud=state.wordCloud!;
  const [accepted,setAccepted]=useState(false);
  const [word,setWord]=useState(""),[pending,setPending]=useState<Pending|null>(null),[notice,setNotice]=useState<{kind:"success"|"warning"|"pending";text:string}|null>(null);
  const current=useRef(state),inFlight=useRef(false),input=useRef<HTMLInputElement>(null);current.current=state;
  function confirmed(){setPending(null);setWord("");setNotice({kind:"success",text:"Palavra confirmada! +100 pontos."});input.current?.focus({preventScroll:true});}
  async function transmit(item:Pending){
    if(inFlight.current)return;
    const latest=current.current.wordCloud;
    if(!latest||latest.slideId!==item.slideId)return;
    if(latest.myWords.some(w=>w.id===item.writeId)){confirmed();return;}
    if(!latest.accepting){setPending(null);setNotice({kind:"warning",text:"O professor pausou ou encerrou os envios. Aguarde a próxima atividade."});return;}
    inFlight.current=true;
    try{await api(`/api/rooms/${state.code}/word`,item);confirmed();void refresh().catch(()=>{});}
    catch(e){if(e instanceof ApiError&&(e.status===0||e.status>=500)){setNotice({kind:"pending",text:"Tentando confirmar sua palavra. Mantenha esta tela aberta."});void refresh().catch(()=>{});}else{setPending(null);setNotice({kind:"warning",text:(e as Error).message});void refresh().catch(()=>{});}}
    finally{inFlight.current=false;}
  }
  useEffect(()=>{if(!pending)return;void transmit(pending);const retry=()=>void transmit(pending),timer=setInterval(retry,2000);window.addEventListener("online",retry);return()=>{clearInterval(timer);window.removeEventListener("online",retry);};},[pending?.writeId]);
  useEffect(()=>{if(pending&&cloud.myWords.some(w=>w.id===pending.writeId))confirmed();},[cloud.myWords,pending?.writeId]);
  function send(event:React.FormEvent){event.preventDefault();if(pending||error||!cloud.accepting||!accepted)return;try{const entry=cloudWord(word);if(cloud.words.some(w=>cloudWord(w.word).key===entry.key)){setNotice({kind:"warning",text:`“${entry.word}” já está na nuvem. Tente outra palavra para ganhar 100 pontos.`});return;}setNotice({kind:"pending",text:"Enviando sua palavra…"});setPending({word:entry.word,writeId:crypto.randomUUID(),slideId:cloud.slideId});}catch(e){setNotice({kind:"warning",text:(e as Error).message});}}
  return <main className="student-word-cloud"><div className="student-cloud-icon"><Cloud size={35}/></div><p className="cloud-eyebrow">NUVEM DE PALAVRAS</p><h1>{cloud.prompt}</h1><p className="student-cloud-rule"><Sparkles size={17}/>Cada palavra nova vale <b>100 pontos</b>.</p>
    {cloud.accepting?<><label style={{display:"flex",gap:10,alignItems:"center",margin:"16px 0"}}><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>Vou respeitar os colegas e a atividade. <a href="/termos" target="_blank" rel="noreferrer">Ler combinados</a></label><form onSubmit={send} className="student-cloud-form"><label htmlFor="cloud-word-input">Sua próxima palavra</label><div><input ref={input} id="cloud-word-input" type="text" maxLength={MAX_CLOUD_WORD_LENGTH} value={word} onChange={event=>{setWord(event.target.value);if(!pending)setNotice(null);}} placeholder="Digite uma palavra…" autoComplete="off" autoCapitalize="none" enterKeyHint="send" disabled={!!pending||!!error}/><button className="btn btn-primary" disabled={!accepted||!word.trim()||!!pending||!!error}>{pending?<Loader2 size={19} className="spin"/>:<Send size={19}/>}Enviar</button></div><small>Uma palavra por envio. Você pode enviar várias palavras diferentes.</small></form></>:<div className="student-cloud-closed" role="status"><Cloud size={20}/>{state.presentation?.blackout?"Envios pausados pelo professor.":"Nuvem concluída. Seus pontos estão no placar da aula."}</div>}
    {notice&&<p className={`student-cloud-notice notice-${notice.kind}`} role={notice.kind==="warning"?"alert":"status"}>{notice.kind==="success"?<Check size={19}/>:notice.kind==="pending"?<Loader2 size={19} className="spin"/>:<Cloud size={19}/>}<span>{notice.text}</span></p>}
    <section className="student-cloud-contributions"><div><h2>Suas palavras</h2><b>{cloud.myWords.length*100} pontos</b></div>{cloud.myWords.length?<ul>{cloud.myWords.map(w=><li key={w.id}><Check size={13}/>{w.word}<small>+100</small></li>)}</ul>:<p>Envie uma palavra que ainda não apareceu na nuvem.</p>}</section>
    <details className="student-cloud-existing"><summary>{cloud.words.length} palavras na nuvem</summary><div>{cloud.words.map(w=><span key={w.id}>{w.word}</span>)}</div></details>
  </main>;
}
