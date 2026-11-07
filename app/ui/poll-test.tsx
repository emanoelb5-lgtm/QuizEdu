"use client";
import {useState} from "react";
import {Dialog,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import {Tabs,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Question} from "@/lib/quiz";
import {pollSummary} from "@/lib/poll";
import {PollDisplay,PollOptions} from "./poll-view";
export function PollTest({question:q,onClose}:{question:Question;onClose:()=>void}){
  const [view,setView]=useState("player"),[selected,setSelected]=useState<number[]>([]),[confirmed,setConfirmed]=useState(false),[revealed,setRevealed]=useState(false);
  const results={...pollSummary(q.options.length,confirmed?[selected]:[]),allowMultiple:!!q.allowMultiple,revealed,myChoices:confirmed?selected:[]};
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="q-dialog question-test-dialog"><DialogTitle>Testar enquete</DialogTitle><DialogDescription>Simule seu voto e a revelação no telão. Este exemplo não registra votos na sala.</DialogDescription>
    <div className="test-toolbar"><Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="player">Como aluno</TabsTrigger><TabsTrigger value="host">No telão</TabsTrigger></TabsList></Tabs><button className="btn btn-outline" onClick={()=>{setSelected([]);setConfirmed(false);setRevealed(false);}}>Recomeçar</button></div>
    <div className="poll-test-content">{view==="host"||revealed?<PollDisplay question={q} results={results} explanation={q.explanation}/>:<><h2>{q.text}</h2><p>{q.allowMultiple?"Marque uma ou mais opções.":"Escolha uma opção."}</p><PollOptions question={q} selected={selected} disabled={confirmed} onChoose={i=>setSelected(old=>q.allowMultiple?old.includes(i)?old.filter(v=>v!==i):[...old,i]:[i])}/><button className="btn btn-primary poll-confirm" disabled={!selected.length||confirmed} onClick={()=>setConfirmed(true)}>{confirmed?"Voto confirmado no exemplo":"Confirmar voto de exemplo"}</button></>}
      <button className="btn btn-outline poll-confirm" onClick={()=>setRevealed(!revealed)}>{revealed?"Ocultar resultados":"Revelar resultados do exemplo"}</button><p className="field-help">Sem gabarito. A enquete não altera os pontos.</p>
    </div>
  </DialogContent></Dialog>;
}
