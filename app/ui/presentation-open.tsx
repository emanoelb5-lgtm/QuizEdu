"use client";
import {useEffect,useRef,useState} from "react";
import {FileUp,Loader2,Check} from "lucide-react";
import {Dialog,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import {Progress} from "@/components/ui/progress";
import {PRESENTATION_ACCEPT} from "@/lib/presentation-import";
import {openPresentationFile} from "@/lib/presentation-file-open";
import {preparePresentation,resolveImportedImages} from "./presentation-import";
import {api} from "./shared";

/** Opens a complete file as its own document, preserving the current presentation. */
export function usePresentationOpen({beforeOpen}:{beforeOpen?:()=>Promise<void>}={}) {
  const input=useRef<HTMLInputElement>(null),running=useRef(false);
  const [busy,setBusy]=useState(false),[visible,setVisible]=useState(false),[progress,setProgress]=useState(0),[phase,setPhase]=useState(""),[name,setName]=useState(""),[error,setError]=useState("");
  async function read(file:File){
    if(running.current)return;running.current=true;setBusy(true);setVisible(true);setError("");setName(file.name);setProgress(0);
    try{
      setPhase("Salvando a apresentação atual…");
      const {deck,warnings}=await openPresentationFile({
        beforeOpen,
        prepare:()=>{setPhase("Abrindo seu arquivo…");return preparePresentation(file,value=>setProgress(Math.round(value*.5)));},
        resolve:(result,slides)=>{setPhase("Preparando imagens e objetos…");setProgress(50);return resolveImportedImages(result,slides,new Map(),value=>setProgress(50+Math.round(value*.4)));},
        save:async deck=>{setPhase("Guardando a apresentação…");setProgress(92);await api("/api/presentations",{deck,revision:0,writeId:crypto.randomUUID()});}
      });
      if(warnings.length){try{sessionStorage.setItem(`prativerso:import:${deck.id}`,JSON.stringify(warnings));}catch{}}
      setProgress(100);setPhase("Pronto! Abrindo o editor…");window.location.assign(`/aulas/${deck.id}`);
    }catch(e){setError((e as Error).message);setBusy(false);running.current=false;}
  }
  return {
    busy,
    open:()=>{if(!running.current)input.current?.click();},
    read,
    surface:<><input ref={input} type="file" accept={PRESENTATION_ACCEPT} className="sr-only" aria-label="Abrir arquivo de apresentação" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void read(file);}}/>
      <Dialog open={visible} onOpenChange={open=>{if(!busy)setVisible(open);}}><DialogContent className="q-dialog presentation-open-dialog" showCloseButton={!busy} onInteractOutside={e=>busy&&e.preventDefault()} onEscapeKeyDown={e=>busy&&e.preventDefault()}>
        <div className="presentation-open-icon">{busy?<Loader2 className="spin" size={30}/>:<FileUp size={30}/>}</div>
        <DialogTitle>{error?"Não foi possível abrir o arquivo":"Abrindo apresentação"}</DialogTitle>
        <DialogDescription>{name}</DialogDescription>
        {busy?<div role="status" aria-live="polite"><p>{phase}</p><Progress value={progress}/><small>Todos os slides serão abertos diretamente para edição.</small></div>:<><p className="form-error" role="alert">{error}</p><div className="dialog-actions"><button className="btn btn-outline" onClick={()=>setVisible(false)}>Fechar</button><button className="btn btn-primary" onClick={()=>input.current?.click()}><FileUp size={17}/>Escolher outro arquivo</button></div></>}
        <p className="field-help"><Check size={15}/>PowerPoint, LibreOffice, PDF ou aula Prativerso · até 15 MB</p>
      </DialogContent></Dialog></>
  };
}

export function ImportNotice({id}:{id:string}){
  const [warnings,setWarnings]=useState<string[]>([]);
  useEffect(()=>{try{const value=JSON.parse(sessionStorage.getItem(`prativerso:import:${id}`)||"[]");setWarnings(Array.isArray(value)?value.filter(v=>typeof v==="string"):[]);}catch{setWarnings([]);}},[id]);
  if(!warnings.length)return null;
  return <details className="presentation-import-notice"><summary>Apresentação importada · confira {warnings.length===1?"uma observação":"as observações"}</summary><ul>{warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul><button onClick={()=>{try{sessionStorage.removeItem(`prativerso:import:${id}`);}catch{}setWarnings([]);}}>Entendi, fechar aviso</button></details>;
}
