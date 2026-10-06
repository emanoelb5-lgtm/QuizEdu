"use client";
import { useEffect, useState } from "react";
import { BookOpen, Check, Edit3, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BankQuestion, LETTERS, newQuestion, Question, quizError } from "@/lib/quiz";
import { api, Loading } from "./shared";
import { QuestionFields, QuestionPatch } from "./question-fields";

export function QuestionBank({onBuild,onChoose}:{onBuild?:(questions:Question[])=>void;onChoose?:(question:Question)=>void}) {
  const [items,setItems]=useState<BankQuestion[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [search,setSearch]=useState("");const [selected,setSelected]=useState<string[]>([]);
  const [editing,setEditing]=useState<BankQuestion|null>(null);const [deleting,setDeleting]=useState<BankQuestion|null>(null);const [busy,setBusy]=useState(false);const [uploads,setUploads]=useState(0);const [showErrors,setShowErrors]=useState(false);
  async function refresh(){try{const data=await api<{questions:BankQuestion[]}>("/api/questions");setItems(data.questions);setError("");}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
  useEffect(()=>{void refresh();},[]);
  const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const filtered=items.filter(item=>normalize(`${item.question.text} ${item.subject} ${item.topic}`).includes(normalize(search)));
  function update(patch:QuestionPatch){setEditing(old=>old?{...old,question:{...old.question,...(typeof patch==="function"?patch(old.question):patch)}}:null);}
  async function save(){if(!editing||uploads)return;const error=quizError({id:editing.id,title:"Banco",questions:[editing.question]});if(error){setShowErrors(true);toast.error(error);return;}setBusy(true);try{await api("/api/questions",editing);setEditing(null);setShowErrors(false);await refresh();toast.success("Questão guardada no banco.");}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}
  async function remove(){if(!deleting)return;setBusy(true);try{await api(`/api/questions/${deleting.id}`,{},"DELETE");setSelected(old=>old.filter(id=>id!==deleting.id));setDeleting(null);await refresh();toast.success("Questão removida do banco.");}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}
  return <section className="bank-workspace">
    <div className="bank-toolbar"><div className="search-field"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pergunta, disciplina ou assunto" aria-label="Buscar no banco de questões"/></div>
      {!onChoose&&<button className="btn btn-primary" onClick={()=>{setShowErrors(false);setEditing({id:crypto.randomUUID(),question:newQuestion(),subject:"",topic:"",updatedAt:0});}}><Plus size={17}/>Nova questão</button>}
      {onBuild&&<button className="btn btn-outline" disabled={!selected.length||selected.length>50} onClick={()=>onBuild(items.filter(i=>selected.includes(i.id)).map(i=>({...structuredClone(i.question),id:crypto.randomUUID()})))}>Montar quiz ({selected.length})</button>}
    </div>
    {error&&<div className="error-panel"><p>{error}</p><button className="btn btn-outline" onClick={refresh}>Tentar novamente</button></div>}
    {loading?<Loading label="Abrindo seu banco de questões…"/>:filtered.length?<div className="bank-list">{filtered.map(item=><article className="bank-card" key={item.id}>
      {onBuild&&<Checkbox checked={selected.includes(item.id)} aria-label={`Selecionar ${item.question.text}`} onCheckedChange={v=>setSelected(old=>v?[...old,item.id]:old.filter(id=>id!==item.id))}/>}
      <div className="bank-card-content"><div className="question-tags">{item.subject&&<span>{item.subject}</span>}{item.topic&&<span>{item.topic}</span>}</div><h3>{item.question.text}</h3>{item.question.image&&<img className="bank-thumbnail" src={item.question.image} alt={item.question.imageAlt||"Imagem da questão"} loading="lazy"/>}<p className="bank-answer"><Check size={15}/> {LETTERS[item.question.correct]} · {item.question.options[item.question.correct]}</p><p className="muted">{item.question.options.length} alternativas · {item.question.seconds} segundos</p></div>
      <div className="bank-actions">{onChoose?<button className="btn btn-primary" onClick={()=>onChoose({...structuredClone(item.question),id:crypto.randomUUID()})}><Plus size={16}/>Adicionar</button>:<><button className="btn btn-outline" onClick={()=>{setShowErrors(false);setEditing(structuredClone(item));}}><Edit3 size={16}/>Editar</button><button className="btn btn-quiet" aria-label={`Excluir ${item.question.text}`} onClick={()=>setDeleting(item)}><Trash2 size={16}/></button></>}</div>
    </article>)}</div>:<div className="empty-panel"><BookOpen size={34}/><h2>{search?"Nenhuma questão encontrada":"Seu banco começa com uma pergunta"}</h2><p>{search?"Experimente outro assunto ou disciplina.":"Guarde questões aqui ou use “Guardar no banco” enquanto prepara um quiz."}</p></div>}
    <Dialog open={!!editing} onOpenChange={v=>{if(!v&&!busy&&!uploads)setEditing(null);}}><DialogContent className="q-dialog bank-edit-dialog"><DialogTitle>{editing?.updatedAt?"Editar questão":"Nova questão"}</DialogTitle><DialogDescription>Esta questão pode ser usada em vários quizzes.</DialogDescription>{editing&&<div className="bank-edit-form"><div className="metadata-fields"><label>Disciplina<input maxLength={60} value={editing.subject} onChange={e=>setEditing({...editing,subject:e.target.value})} placeholder="Ex.: Agroecologia"/></label><label>Assunto<input maxLength={60} value={editing.topic} onChange={e=>setEditing({...editing,topic:e.target.value})} placeholder="Ex.: Cobertura do solo"/></label></div><fieldset disabled={busy} className="question-fieldset"><QuestionFields key={editing.id} q={editing.question} onChange={update} showErrors={showErrors} onUploadChange={v=>setUploads(n=>Math.max(0,n+(v?1:-1)))}/></fieldset><button className="btn btn-primary" disabled={busy||!!uploads} onClick={save}>{busy?<Loader2 size={17} className="spin"/>:<Check size={17}/>}Guardar questão</button></div>}</DialogContent></Dialog>
    <AlertDialog open={!!deleting} onOpenChange={v=>{if(!v)setDeleting(null);}}><AlertDialogContent className="q-dialog"><AlertDialogTitle>Excluir esta questão do banco?</AlertDialogTitle><AlertDialogDescription>Os quizzes que já usam a questão continuam com sua cópia.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={remove} disabled={busy}>Excluir questão</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
