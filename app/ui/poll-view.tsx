"use client";
import {BarChart3,Check,Vote} from "lucide-react";
import type {Question} from "@/lib/quiz";
import type {PollResults} from "@/lib/poll";
export function PollOptions({question:q,results,selected=[],onChoose,disabled=false}:{question:Omit<Question,"correct"|"explanation">;results?:PollResults;selected?:number[];onChoose?:(index:number)=>void;disabled?:boolean}){
  const revealed=!!results?.revealed;
  return <div className={`poll-options ${q.options.length>4?"poll-many-options":""}`} role={onChoose?"group":undefined} aria-label={onChoose?"Opções da enquete":undefined}>
    {q.options.map((text,i)=>{
      const photo=q.optionImages?.[i],chosen=selected.includes(i),content=<><span className="poll-option-letter">{String.fromCharCode(65+i)}</span>{photo&&<img src={photo} alt={text||`Foto da opção ${String.fromCharCode(65+i)}`} className="poll-option-photo" loading="eager"/>}{text&&<span className="poll-option-text">{text}</span>}{onChoose&&<span className={`poll-option-selection ${q.allowMultiple?"is-checkbox":""}`} aria-hidden="true">{chosen&&<Check size={16}/>}</span>}{revealed&&<><div className="poll-option-stat"><strong>{results?.counts?.[i]||0} {(results?.counts?.[i]||0)===1?"aluno":"alunos"}</strong><b>{new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(results?.percentages?.[i]||0)}%</b></div><span className="poll-result-track"><span style={{width:`${results?.percentages?.[i]||0}%`}}/></span></>}</>;
      return onChoose?<button type="button" key={i} className={`poll-option ${chosen?"poll-selected":""}`} aria-pressed={chosen} aria-label={`Opção ${String.fromCharCode(65+i)}${text?`: ${text}`:""}`} disabled={disabled} onClick={()=>onChoose(i)}>{content}</button>:<article key={i} className={`poll-option ${chosen?"poll-selected":""}`}>{content}</article>;
    })}
  </div>;
}
export function PollDisplay({question:q,results,explanation="",slide=false}:{question:Omit<Question,"correct"|"explanation">;results?:PollResults;explanation?:string;slide?:boolean}){
  return <section className={`poll-display ${slide?"poll-on-slide":""}`}>
    <div className="poll-display-meta"><span><Vote size={20}/>ENQUETE</span><b>{results?.revealed?<><BarChart3 size={17}/>Resultados da turma</>:q.allowMultiple?"Escolha várias opções":"Escolha uma opção"}</b></div>
    <h2>{q.text||"Escreva a pergunta da enquete"}</h2>{q.image&&<img className="poll-question-photo" src={q.image} alt={q.imageAlt||"Imagem da enquete"}/>}
    <PollOptions question={q} results={results}/>
    <footer>{results?.revealed?<><span>{results.respondents} {results.respondents===1?"aluno respondeu":"alunos responderam"}</span><span>{q.allowMultiple?"Cada porcentagem considera os alunos que responderam. A soma pode passar de 100%.":"Porcentagens entre os alunos que responderam."}</span></>:<span>Responda pelo celular. As contagens aparecem depois da revelação.</span>}</footer>
    {results?.revealed&&explanation&&<p className="poll-comment">{explanation}</p>}
  </section>;
}
