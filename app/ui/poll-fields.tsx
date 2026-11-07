"use client";
import {Plus,ImagePlus} from "lucide-react";
import type {Question} from "@/lib/quiz";
import {LETTERS,questionIssues} from "@/lib/quiz";
import type {QuestionPatch} from "./question-fields";
import {ImageField} from "./learning-tools";
export function PollFields({q,onChange,onUploadChange,showErrors=false,disabled=false}:{q:Question;onChange:(patch:QuestionPatch)=>void;onUploadChange:(busy:boolean)=>void;showErrors?:boolean;disabled?:boolean}){
  const errors=questionIssues(q).filter(i=>i.severity==="error");
  return <section className="poll-fields">
    {showErrors&&errors.length>0&&<div className="poll-validation" role="alert">{errors.map((issue,i)=><p key={i}>{issue.message}</p>)}</div>}
    <label htmlFor={`text-${q.id}`}>Pergunta da enquete</label><textarea id={`text-${q.id}`} rows={3} maxLength={400} value={q.text} onChange={e=>onChange({text:e.target.value})} placeholder="Que opinião ou preferência você quer conhecer?"/>
    <fieldset className="poll-choice-mode"><legend>Como a turma vai escolher?</legend>{[[false,"Uma opção"],[true,"Várias opções"]].map(([multiple,label])=><label key={String(multiple)}><input type="radio" disabled={disabled} name={`poll-mode-${q.id}`} checked={!!q.allowMultiple===multiple} onChange={()=>onChange({allowMultiple:multiple as boolean,correct:-1})}/>{label}</label>)}</fieldset>
    <p className="field-help">Enquete sem resposta certa, sem cronômetro e sem alterar o ranking. Revele os resultados quando quiser ou quando todos votarem.</p>
    <div className="poll-editor-options">{q.options.map((option,i)=><article key={i}><div className="poll-option-editor-heading"><b>Opção {LETTERS[i]}</b>{q.options.length>2&&<button type="button" disabled={disabled} aria-label={`Remover opção ${LETTERS[i]}`} onClick={()=>onChange(current=>({options:current.options.filter((_,at)=>at!==i),optionImages:current.optionImages?.filter((_,at)=>at!==i)}))}>Remover</button>}</div>
      <input aria-label={`Texto da opção ${LETTERS[i]}`} maxLength={180} value={option} onChange={e=>{const text=e.target.value;onChange(current=>({options:current.options.map((v,at)=>at===i?text:v)}));}} placeholder="Texto ou descrição da foto"/>
      <details open={!!q.optionImages?.[i]} className="option-media"><summary><ImagePlus size={16}/>{q.optionImages?.[i]?"Foto desta opção":"Usar uma foto nesta opção"}</summary><ImageField onBusyChange={onUploadChange} value={q.optionImages?.[i]} label={`Foto da opção ${LETTERS[i]}`} onChange={url=>onChange(current=>({optionImages:current.options.map((_,at)=>at===i?url:current.optionImages?.[at]||"")}))}/></details>
      <small>Use texto, foto ou os dois. Com uma foto, o texto é opcional.</small>
    </article>)}</div>
    {q.options.length<8&&<button className="text-button" type="button" disabled={disabled} onClick={()=>onChange(current=>({options:[...current.options,""],...(current.optionImages?{optionImages:[...current.optionImages,""]}:{})}))}><Plus size={16}/>Adicionar opção</button>}
    <label htmlFor={`explanation-${q.id}`}>Comentário após a enquete <span className="optional">(opcional)</span></label><textarea id={`explanation-${q.id}`} rows={2} maxLength={500} value={q.explanation} onChange={e=>onChange({explanation:e.target.value})} placeholder="Uma orientação para conversar sobre as escolhas da turma."/>
  </section>;
}
