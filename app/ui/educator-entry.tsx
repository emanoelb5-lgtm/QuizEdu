"use client";
import {useState} from "react";
import {GraduationCap,Loader2,ShieldCheck} from "lucide-react";
import {api} from "./shared";

export function EducatorEntry({signInHref,onEntered}:{signInHref:string;onEntered:()=>void}){
  const [name,setName]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  return <div className="presentation-entry"><span className="badge badge-blue">ESPAÇO DO EDUCADOR</span><h1>Uma aula inteira.<br/>A turma participando.</h1><p>Crie slides, intercale perguntas e acompanhe o aprendizado ao vivo.</p><a className="btn btn-primary" href={signInHref} target="_top"><ShieldCheck size={18}/>Começar com minha conta</a><span className="presentation-entry-divider">ou use uma conta temporária · sem senha</span><form className="form-stack" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{await api("/api/profile",{name});onEntered();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label htmlFor="slides-teacher">Como podemos chamar você?</label><input id="slides-teacher" value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={30} required placeholder="Professora Ana"/><button className="btn btn-outline" disabled={busy}>{busy?<Loader2 size={18} className="spin"/>:<GraduationCap size={18}/>}Começar sem senha</button>{error&&<p className="form-error" role="alert">{error}</p>}</form><small>Informe apenas seu nome. O acesso temporário dura 30 dias neste navegador. A conta permanente permite retomar as aulas em outros aparelhos.</small></div>;
}
