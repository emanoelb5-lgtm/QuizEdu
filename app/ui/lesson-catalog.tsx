"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowLeft,ArrowUpRight,BookOpen,BarChart3,Check,Cloud,Copy,Eye,FileText,GraduationCap,Layers,Loader2,MonitorPlay,Search} from "lucide-react";
import {toast} from "sonner";
import {Dialog,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import {filterReadyLessons,lessonMetadata,LESSON_SUBJECTS,LESSON_GRADES,READY_LESSONS,type ReadyLesson} from "@/lib/lesson-catalog";
import type {Profile} from "@/lib/quiz";
import type {SlideDeck} from "@/lib/presentation";
import {api,Brand,Notifications} from "./shared";
import {DeckPreview} from "./presentation-live";
import {EducatorEntry} from "./educator-entry";
import {moveLocalDrafts} from "./draft-storage";

export function LessonCatalog({initialSubject="",signInTargets}:{initialSubject?:string;signInTargets:Record<string,string>}){
  const [subject,setSubject]=useState(LESSON_SUBJECTS.some(s=>s.id===initialSubject)?initialSubject:""),[grade,setGrade]=useState(""),[query,setQuery]=useState("");
  const [profile,setProfile]=useState<Profile|null>(null),[accountReady,setAccountReady]=useState(false),[error,setError]=useState("");
  const [busy,setBusy]=useState<string|null>(null),[previewBusy,setPreviewBusy]=useState<string|null>(null),[preview,setPreview]=useState<SlideDeck|null>(null),[entry,setEntry]=useState<ReadyLesson|null>(null);
  const inFlight=useRef(false),resumed=useRef(false),prepared=useRef<{lessonId:string;deck:SlideDeck;writeId:string}|null>(null);
  async function account(){
    let data=await api<{profile:Profile|null;identity:{name:string}|null;temporaryId?:string}>("/api/dashboard");
    if(data.identity&&!data.profile?.permanent){
      const from=data.temporaryId||data.profile?.id;
      const linked=await api<{profile:Profile}>("/api/account/link",{name:data.profile?.name||data.identity.name});
      if(from)moveLocalDrafts(from,linked.profile.id);
      data=await api<typeof data>("/api/dashboard");
    }
    setProfile(data.profile);setAccountReady(true);setError("");return data.profile;
  }
  useEffect(()=>{let active=true;const selected=new URLSearchParams(window.location.search).get("usar");void account().then(found=>{
    if(!active||!selected||!lessonMetadata(selected)||resumed.current)return;
    resumed.current=true;window.history.replaceState(null,"","/aulas-prontas");
    if(found)void copy(selected);else setEntry(lessonMetadata(selected)!);
  }).catch(e=>{if(active){setError((e as Error).message);setAccountReady(true);}});return()=>{active=false;};},[]);
  async function copy(id:string){
    if(inFlight.current)return;inFlight.current=true;setBusy(id);
    try{
      if(prepared.current?.lessonId!==id){
        const data=await api<{presentation:SlideDeck}>(`/api/lessons/${id}`);
        prepared.current={lessonId:id,deck:data.presentation,writeId:crypto.randomUUID()};
      }
      const content=prepared.current!;
      await api("/api/presentations",{deck:content.deck,revision:0,writeId:content.writeId});
      window.location.assign(`/aulas/${content.deck.id}`);
    }catch(e){toast.error((e as Error).message);}finally{setBusy(null);inFlight.current=false;}
  }
  function useLesson(lesson:ReadyLesson){if(profile)void copy(lesson.id);else setEntry(lesson);}
  async function see(id:string){
    if(previewBusy||busy)return;setPreviewBusy(id);
    try{const data=await api<{presentation:SlideDeck}>(`/api/lessons/${id}`);setPreview(data.presentation);}catch(e){toast.error((e as Error).message);}finally{setPreviewBusy(null);}
  }
  const filtered=filterReadyLessons({subject,grade,query});
  return <div className="app-shell ready-catalog"><header className="topbar"><Brand/><nav><a className="btn btn-quiet" href="/"><ArrowLeft size={17}/>Início</a><a className="btn btn-outline" href="/aulas"><MonitorPlay size={17}/>Minhas apresentações</a></nav></header>
    <main className="workspace"><section className="ready-catalog-heading"><p className="eyebrow"><BookOpen size={17}/>CONTEÚDO PARA A SUA TURMA</p><h1>Aulas prontas<span className="title-dot">.</span></h1><p>Escolha uma disciplina, encontre o assunto e prepare sua aula a partir de uma cópia editável.</p><div className="ready-catalog-promise"><span><Check size={15}/>Prévia antes de usar</span><span><Copy size={15}/>Cópia para editar</span><span><MonitorPlay size={15}/>Participação ao vivo</span></div></section>
      <section className="ready-catalog-filters" aria-label="Encontrar uma aula"><div className="ready-subjects" aria-label="Disciplinas"><button aria-pressed={!subject} onClick={()=>setSubject("")}>Todas <span>{READY_LESSONS.length}</span></button>{LESSON_SUBJECTS.map(item=><button key={item.id} aria-pressed={subject===item.id} onClick={()=>setSubject(item.id)}>{item.name}<span>{READY_LESSONS.filter(l=>l.subjectId===item.id).length}</span></button>)}</div><div className="ready-search-row"><div className="search-field"><Search size={19}/><input type="search" maxLength={120} aria-label="Buscar aulas prontas" placeholder="Busque pelo assunto ou título da aula" value={query} onChange={e=>setQuery(e.target.value)}/></div><label className="ready-grade-filter"><GraduationCap size={18}/><span className="sr-only">Ano escolar</span><select aria-label="Filtrar por ano escolar" value={grade} onChange={e=>setGrade(e.target.value)}><option value="">Todos os anos</option>{LESSON_GRADES.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div></section>
      {error&&<div className="error-panel" role="alert"><p>{error}</p><button className="btn btn-outline" onClick={()=>void account().catch(e=>setError((e as Error).message))}>Tentar novamente</button></div>}
      <div className="ready-results-heading"><h2>{subject?LESSON_SUBJECTS.find(s=>s.id===subject)!.name:"Todas as disciplinas"}</h2><span aria-live="polite">{filtered.length} {filtered.length===1?"aula encontrada":"aulas encontradas"}</span></div>
      <div className="ready-lesson-grid">{filtered.map(lesson=><article className="ready-lesson-card" key={lesson.id}>
        <div className={`ready-lesson-cover ${lesson.thumbnail?"":"ready-cover-literature"}`}>{lesson.thumbnail?<img src={lesson.thumbnail} alt={`Ilustração da aula ${lesson.title}`} loading="lazy" width={1000} height={563}/>:<><BookOpen size={64} strokeWidth={1.25}/><span>CONTOS<br/>EM DIÁLOGO</span></>}<span className="ready-cover-subject">{lesson.subject}</span></div>
        <div className="ready-lesson-body"><p className="ready-lesson-level">{lesson.gradeLabel} <span>·</span> {lesson.unit}</p><h3>{lesson.title}</h3><p className="ready-lesson-description">{lesson.description}</p><div className="ready-lesson-stats"><span><Layers size={15}/>{lesson.slideCount} slides</span><span><Check size={15}/>{lesson.questionCount} perguntas</span>{!!lesson.pollCount&&<span><BarChart3 size={15}/>{lesson.pollCount} enquetes</span>}{lesson.cloudCount>0&&<span><Cloud size={15}/>Nuvem de palavras</span>}</div>
          <details className="ready-lesson-objectives"><summary>O que a turma vai aprender</summary><ul>{lesson.objectives.map(objective=><li key={objective}>{objective}</li>)}</ul></details>
          <div className="ready-lesson-actions"><button className="btn btn-outline" disabled={!!previewBusy||!!busy} onClick={()=>void see(lesson.id)}>{previewBusy===lesson.id?<Loader2 size={17} className="spin"/>:<Eye size={17}/>}Ver aula</button><button className="btn btn-primary" disabled={!accountReady||!!error||!!busy||!!previewBusy} onClick={()=>useLesson(lesson)}>{busy===lesson.id?<Loader2 size={17} className="spin"/>:<Copy size={17}/>}Usar aula</button></div>
          {lesson.hasSupportText&&<a className="ready-support-link" href={`/aulas-prontas/${lesson.id}/texto`} target="_blank" rel="noopener noreferrer"><FileText size={16}/>Texto de apoio para ler e imprimir<ArrowUpRight size={15}/></a>}
        </div></article>)}</div>
      {!filtered.length&&<div className="empty-panel"><Search size={32}/><h2>Nenhuma aula com esses filtros</h2><p>Tente outro assunto ou escolha uma disciplina diferente.</p><button className="btn btn-outline" onClick={()=>{setSubject("");setGrade("");setQuery("");}}>Limpar filtros</button></div>}
      <footer className="site-footer"><span>Prativerso · Conhecimento em prática</span><span>Adapte o conteúdo à sua turma.</span></footer>
    </main>{preview&&<DeckPreview deck={preview} onClose={()=>setPreview(null)}/>}
    <Dialog open={!!entry} onOpenChange={open=>{if(!open)setEntry(null);}}><DialogContent className="q-dialog ready-entry-dialog"><DialogTitle>Use esta aula na sua turma</DialogTitle><DialogDescription>{entry?.title} · {entry?.gradeLabel}. Você receberá uma cópia para editar e apresentar.</DialogDescription>{entry&&<EducatorEntry signInHref={signInTargets[entry.id]} onEntered={()=>{const id=entry.id;setEntry(null);void account().then(()=>copy(id)).catch(e=>toast.error((e as Error).message));}}/>}</DialogContent></Dialog><Notifications/>
  </div>;
}
