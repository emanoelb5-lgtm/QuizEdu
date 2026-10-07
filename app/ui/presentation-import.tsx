"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {FileUp,Loader2,Check,Image as ImageIcon} from "lucide-react";
import {toast} from "sonner";
import {Dialog,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import {Checkbox} from "@/components/ui/checkbox";
import {Progress} from "@/components/ui/progress";
import {baseElement,duplicateSlide,LessonSlide,newDeck,newSlide,SlideDeck,validateDeck} from "@/lib/presentation";
import {PRESENTATION_ACCEPT,MAX_IMPORT_BYTES,PresentationImport} from "@/lib/presentation-import";
import {SlideCanvas} from "./slide-canvas";

const bytesFromBase64=(data:string)=>Uint8Array.from(atob(data),c=>c.charCodeAt(0));
export async function preparePresentation(file:File,onProgress:(value:number)=>void):Promise<PresentationImport>{
  if(file.size>MAX_IMPORT_BYTES)throw new Error("Use uma apresentação de até 15 MB.");
  if(file.name.toLowerCase().endsWith(".pdf")){
    const pdfjs=await import("pdfjs-dist");pdfjs.GlobalWorkerOptions.workerSrc="/pdf.worker.min.mjs";
    const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableAutoFetch:true,standardFontDataUrl:"/pdf-assets/standard_fonts/",wasmUrl:"/pdf-assets/wasm/",cMapUrl:"/pdf-assets/cmaps/",cMapPacked:true});const pdf=await task.promise;
    const result:PresentationImport={deck:{...newDeck(),title:file.name.replace(/\.pdf$/i,"").slice(0,100)||"PDF importado",slides:[]},assets:[],format:"PDF",warnings:["PDF: cada página entra como uma imagem. Você pode adicionar textos, formas e perguntas; o texto original da página não é editável."]};
    try{if(pdf.numPages>150)throw new Error("Use um PDF de até 150 páginas.");let total=0;
      for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),original=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(1600/original.width,900/original.height)}),canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const context=canvas.getContext("2d")!;await page.render({canvas,canvasContext:context,viewport,background:"rgb(255,255,255)"}).promise;const data=canvas.toDataURL("image/jpeg",.83).split(",")[1];total+=data.length*3/4;if(total>12*1024*1024)throw new Error("As páginas do PDF ultrapassam 12 MB. Divida o arquivo.");const id=crypto.randomUUID(),slide=newSlide("blank");slide.title=`Página ${i}`;slide.elements=[{...baseElement("image"),x:0,y:0,w:1000,h:562.5,src:`/api/media/${id}`,alt:`Página ${i} do PDF ${result.deck.title}`,fit:"contain",radius:0}];result.deck.slides.push(slide);result.assets.push({id,mime:"image/jpeg",data});canvas.width=canvas.height=0;page.cleanup();onProgress(Math.round(i/pdf.numPages*100));}
      return result;
    }finally{await task.destroy();}
  }
  onProgress(10);const {importPresentation}=await import("@/lib/presentation-import");const result=await importPresentation(new Uint8Array(await file.arrayBuffer()),file.name);onProgress(100);return result;
}
async function normalizedImage(asset:PresentationImport["assets"][number]){
  const blob=new Blob([bytesFromBase64(asset.data)],{type:asset.mime});const bitmap=await createImageBitmap(blob);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext("2d")!;ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  let output=await new Promise<Blob|null>(r=>canvas.toBlob(r,"image/png"));if(!output||output.size>1000000){ctx.globalCompositeOperation="destination-over";ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);for(const quality of [.85,.65,.45,.25]){output=await new Promise<Blob|null>(r=>canvas.toBlob(r,"image/jpeg",quality));if(output&&output.size<=1000000)break;}}
  canvas.width=canvas.height=0;if(!output||output.size>1048576)throw new Error("Uma imagem não pôde ser reduzida. Use uma imagem menor no arquivo original.");return output;
}
export async function resolveImportedImages(result:PresentationImport,slides:LessonSlide[],uploaded:Map<string,string>,onProgress:(value:number)=>void):Promise<LessonSlide[]>{
  const used=new Set(slides.flatMap(s=>[s.background.image,...s.elements.filter(e=>e.type==="image").map(e=>e.src)]).filter(Boolean));const assets=result.assets.filter(a=>used.has(`/api/media/${a.id}`));
  for(let i=0;i<assets.length;i++){const asset=assets[i];if(!uploaded.has(asset.id)){const body=await normalizedImage(asset);const response=await fetch("/api/media",{method:"POST",headers:{"Content-Type":body.type},body});const data=await response.json() as {error?:string;url:string};if(!response.ok)throw new Error(data.error||"Não foi possível guardar a imagem.");uploaded.set(asset.id,data.url);}onProgress(Math.round((i+1)/assets.length*100));}
  return slides.map(s=>({...s,background:{...s.background,...(s.background.image?{image:uploaded.get(s.background.image.slice(11))||s.background.image}:{})},elements:s.elements.map(e=>e.type==="image"&&e.src?{...e,src:uploaded.get(e.src.slice(11))||e.src}:e)}));
}
export function PresentationImportDialog({onClose,onImport,remaining=150,remainingQuestions=50}:{onClose:()=>void;onImport:(deck:SlideDeck)=>Promise<void>|void;remaining?:number;remainingQuestions?:number}){
  const [result,setResult]=useState<PresentationImport|null>(null),[selected,setSelected]=useState<number[]>([]),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[phase,setPhase]=useState(""),[error,setError]=useState("");const input=useRef<HTMLInputElement>(null),uploads=useRef(new Map<string,string>());
  const urls=useMemo(()=>new Map(result?.assets.map(a=>[a.id,URL.createObjectURL(new Blob([bytesFromBase64(a.data)],{type:a.mime}))])||[]),[result]);useEffect(()=>()=>{urls.forEach(u=>URL.revokeObjectURL(u));},[urls]);
  const previews=result?.deck.slides.map(s=>({...s,background:{...s.background,...(s.background.image&&urls.has(s.background.image.slice(11))?{image:urls.get(s.background.image.slice(11))}:{})},elements:s.elements.map(e=>e.type==="image"&&e.src&&urls.has(e.src.slice(11))?{...e,src:urls.get(e.src.slice(11))!}:e)}))||[];
  async function read(file:File){setBusy(true);setError("");setProgress(0);setPhase("Lendo apresentação…");setResult(null);uploads.current.clear();try{const prepared=await preparePresentation(file,setProgress);setResult(prepared);setSelected(prepared.deck.slides.map((_,i)=>i));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const questions=selected.filter(i=>result?.deck.slides[i]?.kind==="question").length,overflow=selected.length>remaining||questions>remainingQuestions;
  return <Dialog open onOpenChange={open=>!open&&!busy&&onClose()}><DialogContent className="q-dialog presentation-import-dialog" onInteractOutside={e=>busy&&e.preventDefault()} onEscapeKeyDown={e=>busy&&e.preventDefault()}><DialogTitle>Importar apresentação</DialogTitle><DialogDescription>Escolha o arquivo, confira os slides e selecione os que deseja trazer para a aula.</DialogDescription>
    <input ref={input} type="file" accept={PRESENTATION_ACCEPT} className="sr-only" aria-label="Arquivo de apresentação" onChange={e=>{const file=e.target.files?.[0];if(file)void read(file);e.target.value="";}}/>
    <button className="presentation-import-drop" disabled={busy} onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy&&e.dataTransfer.files[0])void read(e.dataTransfer.files[0]);}}><FileUp size={28}/><b>{result?"Escolher outro arquivo":"Escolher ou arrastar arquivo"}</b><span>PPT, PPTX, PPS, PPSX, POT, POTX, ODP, OTP, PDF e JSON · até 15 MB</span></button>
    {busy&&<div role="status"><p><Loader2 size={17} className="spin"/> {phase}</p><Progress value={progress}/></div>}{error&&<p role="alert" className="form-error">{error}</p>}
    {result&&<><div className="presentation-import-summary"><b>{result.deck.title}</b><span>{result.format} · {result.deck.slides.length} slides · {result.assets.length} imagens</span></div>{result.warnings.length>0&&<div className="presentation-import-warnings"><b>Confira antes de importar</b><ul>{result.warnings.map(w=><li key={w}>{w}</li>)}</ul></div>}
      <div className="presentation-import-selection"><button disabled={busy} onClick={()=>setSelected(previews.map((_,i)=>i))}>Selecionar todos</button><button disabled={busy} onClick={()=>setSelected([])}>Limpar seleção</button><span>{selected.length} selecionados · cabem {remaining}</span></div>
      <div className="presentation-import-grid">{previews.map((s,i)=><label key={s.id} className={`presentation-import-card ${selected.includes(i)?"selected":""}`}><SlideCanvas slide={s} theme={result.deck.theme} draft eagerImages/><span><Checkbox disabled={busy} checked={selected.includes(i)} onCheckedChange={checked=>setSelected(old=>checked?[...old,i].sort((a,b)=>a-b):old.filter(v=>v!==i))}/><b>{i+1}. {s.title}</b></span></label>)}</div>
      {overflow&&<p role="alert" className="form-error">Selecione até {remaining} slides e {remainingQuestions} perguntas que cabem na aula.</p>}
      <footer className="presentation-import-footer"><button className="btn btn-outline" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy||!selected.length||overflow} onClick={async()=>{setBusy(true);setError("");setPhase("Guardando imagens e inserindo slides…");setProgress(0);try{const slides=await resolveImportedImages(result,selected.map(i=>duplicateSlide(result.deck.slides[i])),uploads.current,setProgress);await onImport(validateDeck({...result.deck,id:crypto.randomUUID(),slides}));toast.success(`${slides.length} slides importados.`);onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?<Loader2 size={17} className="spin"/>:<Check size={17}/>}Importar {selected.length} slides</button></footer></>}
    {!result&&!busy&&<p className="field-help"><ImageIcon size={16}/> PDF abre como páginas visuais. PPT antigo recupera os textos; para manter mais detalhes, prefira PPTX.</p>}
  </DialogContent></Dialog>;
}
