"use client";
import {useEffect,useState} from "react";
import {Check,Clock3,RotateCcw,X} from "lucide-react";
import {Dialog,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import {Tabs,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Progress} from "@/components/ui/progress";
import {GameMode,LETTERS,points,Question,scoreFor} from "@/lib/quiz";
import {AnswerOptions,QuestionHeading} from "./question-view";

export function QuestionTest({question,mode,untimed,onClose}:{question:Question;mode:GameMode;untimed:boolean;onClose:()=>void}) {
  const [view,setView]=useState("player");const [started,setStarted]=useState(()=>Date.now());const [now,setNow]=useState(()=>Date.now());const [chosen,setChosen]=useState<number|null>(null);const [elapsed,setElapsed]=useState(0);const [result,setResult]=useState(false);
  const seconds=Math.max(0,Math.ceil((started+question.seconds*1000-now)/1000));
  useEffect(()=>{if(result)return;const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[result,started]);
  useEffect(()=>{if(!untimed&&!seconds)setResult(true);},[seconds,untimed]);
  function restart(){const time=Date.now();setStarted(time);setNow(time);setChosen(null);setElapsed(0);setResult(false);}
  function choose(index:number){if(result||chosen!==null||(!untimed&&Date.now()>=started+question.seconds*1000))return;setChosen(index);setElapsed(Math.max(0,Date.now()-started));}
  const correct=chosen===question.correct;const score=chosen===null?0:mode==="accuracy"?(correct?1000:0):scoreFor(correct,elapsed,question.seconds*1000,true);
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="q-dialog question-test-dialog"><DialogTitle>Testar esta pergunta</DialogTitle><DialogDescription>Experimente a leitura e a resposta. Este teste não abre uma sala nem entra no histórico.</DialogDescription>
    <div className="test-toolbar"><Tabs value={view} onValueChange={setView}><TabsList aria-label="Tela para testar"><TabsTrigger value="player">Como aluno</TabsTrigger><TabsTrigger value="host">No telão</TabsTrigger></TabsList></Tabs><button className="btn btn-outline" onClick={restart}><RotateCcw size={16}/>Recomeçar</button></div>
    <div className={`test-surface ${view==="host"?"room-shell":"player-shell"}`}><div className={view==="host"?"live-workspace":"player-live"}>
      {result?<div className="test-result"><span className={`result-icon ${correct?"result-success":"result-neutral"}`}>{correct?<Check size={30}/>:<X size={30}/>}</span><h2>{correct?"Resposta correta!":chosen===null?"Sem resposta neste teste":"Vamos conferir a resposta"}</h2><p className="test-points">{points(score)} pontos neste exemplo</p>{mode==="speed"&&correct&&<p className="test-instruction">Você é o único participante neste teste: seu acerto vale os 1.000 pontos do primeiro a acertar.</p>}<div className="player-correct-answer"><span>RESPOSTA CORRETA</span><b>{LETTERS[question.correct]} · {question.options[question.correct]}</b>{question.optionImages?.[question.correct]&&<img className="reveal-image" src={question.optionImages[question.correct]} alt={question.options[question.correct]}/>} {question.explanation&&<p>{question.explanation}</p>}</div><button className="btn btn-primary" onClick={restart}>Tentar novamente</button></div>:<>
        <div className={view==="host"?"host-timer":"player-timer"}><Clock3 size={20}/><b>{untimed?"Tempo livre":`${seconds}s`}</b>{!untimed&&<Progress value={seconds/question.seconds*100} aria-label="Tempo restante neste teste"/>}</div>
        <QuestionHeading question={question} host={view==="host"}/>
        {chosen!==null&&view==="player"?<div className="answer-sent"><span className="answer-sent-icon"><Check size={30}/></span><h2>Resposta enviada no teste</h2><p>{LETTERS[chosen]} · {question.options[chosen]}</p><button className="btn btn-primary" onClick={()=>setResult(true)}>Ver resultado</button></div>:<AnswerOptions question={question} onChoose={view==="player"?choose:undefined} disabled={chosen!==null||(!untimed&&!seconds)}/>}
        {view==="host"&&<p className="test-instruction">Use “Como aluno” para escolher uma alternativa.</p>}
        {chosen===null&&<button className="btn btn-outline test-reveal" onClick={()=>setResult(true)}>Conferir o gabarito</button>}
      </>}
    </div></div>
  </DialogContent></Dialog>;
}
