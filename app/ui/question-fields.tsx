"use client";
import { Check, Clock3, Plus } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DURATIONS, LETTERS, Question } from "@/lib/quiz";
import { ImageField } from "./learning-tools";
export type QuestionPatch = Partial<Question> | ((current:Question)=>Partial<Question>);
export function QuestionFields({q,onChange,untimed=false}:{q:Question;onChange:(patch:QuestionPatch)=>void;untimed?:boolean}) {
  return <>
    <label htmlFor={`text-${q.id}`}>O que você quer perguntar?</label><textarea id={`text-${q.id}`} rows={3} maxLength={400} value={q.text} onChange={e=>onChange({text:e.target.value})} placeholder="Escreva uma pergunta clara para sua turma…"/><div className="field-counter">{q.text.length}/400</div>
    <ImageField value={q.image} alt={q.imageAlt} onChange={image=>onChange({image})} onAltChange={imageAlt=>onChange({imageAlt})}/>
    <div className="alternatives-heading"><label>Alternativas</label><span><Check size={14}/>Marque a correta</span></div>
    <RadioGroup value={String(q.correct)} onValueChange={value=>onChange({correct:Number(value)})} className="alternatives">
      {q.options.map((option,i)=><div className={`alternative-with-image option-${i}`} key={i}>
        <div className={`alternative-field option-${i} ${q.correct===i?"is-correct":""}`}><span className="letter">{LETTERS[i]}</span><input aria-label={`Alternativa ${LETTERS[i]}`} maxLength={180} value={option} onChange={e=>{const value=e.target.value;onChange(current=>({options:current.options.map((o,at)=>at===i?value:o)}));}} placeholder={`Alternativa ${LETTERS[i]}`}/><RadioGroupItem value={String(i)} aria-label={`Marcar alternativa ${LETTERS[i]} como correta`} className="correct-radio"/>
          {q.options.length>2&&<button className="remove-option" aria-label={`Remover alternativa ${LETTERS[i]}`} onClick={()=>onChange(current=>({options:current.options.filter((_,at)=>at!==i),optionImages:current.optionImages?.filter((_,at)=>at!==i),correct:current.correct===i?0:current.correct>i?current.correct-1:current.correct}))}>×</button>}
        </div>
        <ImageField value={q.optionImages?.[i]} label={`Foto na alternativa ${LETTERS[i]}`} onChange={url=>onChange(current=>({optionImages:current.options.map((_,at)=>at===i?url:current.optionImages?.[at]||"")}))}/>
      </div>)}
    </RadioGroup>
    {q.options.length<4&&<button className="text-button" onClick={()=>onChange(current=>({options:[...current.options,""],...(current.optionImages?{optionImages:[...current.optionImages,""]}:{})}))}><Plus size={15}/>Adicionar alternativa</button>}
    <div className="question-settings"><div><label><Clock3 size={17}/>Tempo para responder</label>{untimed?<p className="field-help">Tempo livre. A rodada termina quando todos respondem ou quando você a encerra.</p>:<Select value={String(q.seconds)} onValueChange={value=>onChange({seconds:Number(value)})}><SelectTrigger className="duration-select" aria-label="Tempo para responder"><SelectValue/></SelectTrigger><SelectContent>{DURATIONS.map(s=><SelectItem key={s} value={String(s)}>{s} segundos</SelectItem>)}</SelectContent></Select>}</div></div>
    <label htmlFor={`explanation-${q.id}`}>Explicação após a rodada <span className="optional">(opcional)</span></label><textarea id={`explanation-${q.id}`} rows={2} maxLength={500} value={q.explanation} onChange={e=>onChange({explanation:e.target.value})} placeholder="Explique por que a resposta está correta."/>
  </>;
}
