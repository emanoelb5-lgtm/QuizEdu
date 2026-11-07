"use client";
import {ArrowLeft,Printer} from "lucide-react";
export function LessonSupportText({text,lessonTitle,grade}:{text:{title:string;credit:string;paragraphs:string[]};lessonTitle:string;grade:string}){
  return <div className="lesson-text-page"><header><a className="btn btn-quiet" href="/aulas-prontas?disciplina=portugues"><ArrowLeft size={17}/>Aulas prontas</a><button className="btn btn-primary" onClick={()=>window.print()}><Printer size={18}/>Imprimir texto</button></header><article><p className="lesson-text-label">PORTUGUÊS · {grade} · {lessonTitle}</p><h1>{text.title}</h1>{text.paragraphs.map((paragraph,index)=><p className="lesson-text-paragraph" key={index}>{paragraph}</p>)}<footer>{text.credit}</footer></article></div>;
}
