"use client";
import {Check,ClipboardCheck} from "lucide-react";
import {Dialog,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import {Quiz,questionIssues,quizError} from "@/lib/quiz";

export function QuestionReviewDialog({quiz,onGo,onClose}:{quiz:Quiz;onGo:(index:number)=>void;onClose:()=>void}){
  const reviews=quiz.questions.map(questionIssues);const ready=reviews.filter(issues=>!issues.some(i=>i.severity==="error")).length;const overall=quizError(quiz);
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="q-dialog question-review-dialog"><DialogTitle>Revisar antes de jogar</DialogTitle><DialogDescription>{ready} de {quiz.questions.length} perguntas com os campos obrigatórios preenchidos.</DialogDescription>
    {overall&&!overall.startsWith("Pergunta ")&&<p className="form-error" role="alert">{overall}</p>}
    <div className="question-review-list">{quiz.questions.map((q,index)=>{const issues=reviews[index];const errors=issues.filter(i=>i.severity==="error");return <article key={q.id}><span className={`review-number ${errors.length?"review-incomplete":""}`}>{errors.length?index+1:<Check size={18}/>}</span><div><h3>{index+1}. {q.text||"Nova pergunta"}</h3>{issues.length?issues.map((issue,i)=><p key={i} className={issue.severity==="error"?"field-error":"field-warning"}>{issue.message}</p>):<p className="review-complete">Pronta para jogar.</p>}</div><button className="btn btn-outline" onClick={()=>onGo(index)}>{errors.length?"Completar":"Conferir"}</button></article>;})}</div>
    <div className="review-footer"><ClipboardCheck size={19}/><p>{ready===quiz.questions.length?"Confira a leitura e o gabarito. Quando terminar, salve o quiz para abrir a sala.":"Complete as perguntas indicadas. Os rascunhos continuam guardados enquanto você edita."}</p></div><button className="btn btn-primary" onClick={onClose}>Voltar ao editor</button>
  </DialogContent></Dialog>;
}
