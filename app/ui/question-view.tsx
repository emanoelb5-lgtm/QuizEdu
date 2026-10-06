"use client";
import {LETTERS, Question} from "@/lib/quiz";
import {QuestionImage, ReadButton} from "./learning-tools";

type VisibleQuestion=Omit<Question,"correct"|"explanation">;
export function QuestionHeading({question,host=false}:{question:VisibleQuestion;host?:boolean}) {
  const spoken=`${question.text}. ${question.options.map((o,i)=>`${LETTERS[i]}: ${o}`).join(". ")}`;
  return <><h1 className={`${host?"host-question ":""}readable-question`}>{question.text}</h1><QuestionImage url={question.image} alt={question.imageAlt}/><ReadButton text={spoken}/></>;
}
export function AnswerOptions({question,onChoose,disabled=false}:{question:VisibleQuestion;onChoose?:(index:number)=>void;disabled?:boolean}) {
  return <div className={onChoose?"player-options":"host-options"}>{question.options.map((option,i)=>{
    const content=<><span className="letter">{LETTERS[i]}</span><span>{question.optionImages?.[i]&&<img className="option-image" src={question.optionImages[i]} alt={option}/>} {option}</span></>;
    return onChoose?<button className={`answer-option option-${i}`} key={i} disabled={disabled} onClick={()=>onChoose(i)}>{content}</button>:<div className={`answer-option option-${i}`} key={i}>{content}</div>;
  })}</div>;
}
