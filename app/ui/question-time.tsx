"use client";
import {useState} from "react";
import {Clock3} from "lucide-react";
import {Checkbox} from "@/components/ui/checkbox";
import {Dialog,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {DURATIONS,Question} from "@/lib/quiz";

export function QuestionTimeDialog({questions,untimed,onApply,onClose}:{questions:Question[];untimed:boolean;onApply:(ids:string[],seconds:number)=>void;onClose:()=>void}){
  const [selected,setSelected]=useState(questions.map(q=>q.id));const [seconds,setSeconds]=useState(String(questions[0]?.seconds||30));
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="q-dialog question-time-dialog"><DialogTitle>Tempo de várias perguntas</DialogTitle><DialogDescription>Escolha o tempo e as perguntas que vão recebê-lo.{untimed&&" Esta atividade está em tempo livre; os tempos serão usados se você voltar a ativar o cronômetro."}</DialogDescription>
    <label className="bulk-duration"><Clock3 size={19}/>Tempo<Select value={seconds} onValueChange={setSeconds}><SelectTrigger aria-label="Tempo para as perguntas selecionadas"><SelectValue/></SelectTrigger><SelectContent>{DURATIONS.map(s=><SelectItem key={s} value={String(s)}>{s} segundos</SelectItem>)}</SelectContent></Select></label><div className="import-selection"><button className="text-button" onClick={()=>setSelected(questions.map(q=>q.id))}>Selecionar todas</button><button className="text-button" onClick={()=>setSelected([])}>Limpar seleção</button><span>{selected.length} selecionadas</span></div><div className="bulk-question-list">{questions.map((q,i)=><label key={q.id}><Checkbox checked={selected.includes(q.id)} onCheckedChange={v=>setSelected(old=>v?[...old,q.id]:old.filter(id=>id!==q.id))}/><span><b>{i+1}. {q.text||"Nova pergunta"}</b><small>Tempo atual: {q.seconds}s</small></span></label>)}</div><button className="btn btn-primary" disabled={!selected.length} onClick={()=>{onApply(selected,Number(seconds));onClose();}}>Aplicar a {selected.length} {selected.length===1?"pergunta":"perguntas"}</button>
  </DialogContent></Dialog>;
}
