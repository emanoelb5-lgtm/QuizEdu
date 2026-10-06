"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Volume2, Square, Wifi, X } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "./shared";

export function ImageField({value,onChange,label="Imagem da pergunta",alt,onAltChange,onBusyChange}:{value?:string;onChange:(url:string)=>void;label?:string;alt?:string;onAltChange?:(text:string)=>void;onBusyChange?:(busy:boolean)=>void}) {
  const input=useRef<HTMLInputElement>(null); const [busy,setBusy]=useState(false);
  async function upload(file:File) {
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){toast.error("Escolha uma foto JPEG, PNG ou WebP.");return;}
    if(file.size>12*1024*1024){toast.error("Escolha uma foto de até 12 MB. Ela será reduzida antes do envio.");return;}
    setBusy(true); onBusyChange?.(true); let objectUrl="";
    try {
      objectUrl=URL.createObjectURL(file); const img=new Image(); img.src=objectUrl; await img.decode();
      const scale=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight)); const canvas=document.createElement("canvas"); canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const context=canvas.getContext("2d"); if(!context)throw new Error("Não foi possível preparar a imagem."); context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.8)); if(!blob||blob.size>1048576)throw new Error("Essa foto ainda está grande. Escolha uma imagem menor.");
      const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),25000); let response:Response;
      try {response=await fetch("/api/media",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"image/jpeg"},body:blob,signal:controller.signal});}finally{clearTimeout(timeout);}
      const data=await response.json() as {error?:string;url:string}; if(!response.ok)throw new Error(data.error||"Não foi possível enviar agora."); onChange(data.url);toast.success("Imagem adicionada.");
    }catch(e){toast.error((e as Error).message||"O envio foi interrompido. Escolha a imagem novamente.");}finally{if(objectUrl)URL.revokeObjectURL(objectUrl);setBusy(false);onBusyChange?.(false);if(input.current)input.current.value="";}
  }
  return <div className={`image-field ${onAltChange?"image-field-main":"image-field-option"}`}>
    {value&&<div className="image-field-preview"><img src={value} alt={alt||label} loading="lazy"/><button type="button" disabled={busy} aria-label={`Remover ${label.toLowerCase()}`} onClick={()=>onChange("")}><X size={16}/></button></div>}
    <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>input.current?.click()}>{busy?<Loader2 size={17} className="spin"/>:<ImagePlus size={17}/>} {value?"Trocar imagem":label}</button>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}}/>
    {value&&onAltChange&&<label className="image-description">Descrição da imagem<input maxLength={180} value={alt||""} onChange={e=>onAltChange(e.target.value)} placeholder="Ex.: folha de mandioca com manchas amarelas"/></label>}
  </div>;
}
export function ReadButton({text}:{text:string}) {
  const [available,setAvailable]=useState(false);const [reading,setReading]=useState(false);const utterance=useRef<SpeechSynthesisUtterance|null>(null);
  useEffect(()=>{setAvailable("speechSynthesis" in window&&"SpeechSynthesisUtterance" in window);return()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel();};},[]);
  useEffect(()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel();setReading(false);},[text]);
  function read(){if(!available)return;if(reading){window.speechSynthesis.cancel();setReading(false);return;}window.speechSynthesis.cancel();const value=new SpeechSynthesisUtterance(text);value.lang="pt-BR";value.rate=.9;value.voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase()==="pt-br")||window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith("pt"))||null;value.onend=()=>setReading(false);value.onerror=()=>{setReading(false);toast.info("A voz não está disponível neste navegador.");};utterance.current=value;setReading(true);window.speechSynthesis.speak(value);}
  return <button className="btn btn-quiet read-button" disabled={!available||!text} aria-pressed={reading} onClick={read}>{reading?<Square size={16}/>:<Volume2 size={18}/>} {reading?"Parar leitura":available?"Ouvir pergunta":"Leitura indisponível"}</button>;
}
export function ConnectionCheck(){const [busy,setBusy]=useState(false);const [latency,setLatency]=useState<number|null>(null);const [failed,setFailed]=useState(false);
  async function test(){setBusy(true);setFailed(false);const start=performance.now();try{await api("/api/ping");setLatency(Math.round(performance.now()-start));}catch{setLatency(null);setFailed(true);}finally{setBusy(false);}}
  return <div className="connection-check"><button className="btn btn-quiet" disabled={busy} onClick={test}>{busy?<Loader2 size={16} className="spin"/>:<Wifi size={17}/>}Testar conexão</button><span role="status">{busy?"Testando…":failed?"Sem resposta do servidor. Tente reconectar.":latency===null?"Faça o teste antes de começar.":`${latency<350?"Resposta rápida":latency<1500?"Conexão funcionando":"Resposta lenta"} · ${latency} ms`}</span></div>;
}
export function useGamePreferences(){const [scale,setScale]=useState("1");const [sound,setSound]=useState(false);const audio=useRef<AudioContext|null>(null);
  useEffect(()=>{try{const stored=localStorage.getItem("qe_text_scale");setScale(stored&&["1","1.15","1.3"].includes(stored)?stored:"1");setSound(localStorage.getItem("qe_sound")==="true");}catch{}return()=>{void audio.current?.close();};},[]);
  function tone(celebrate=false){if(!sound)return;try{const Audio=window.AudioContext||(window as any).webkitAudioContext;if(!Audio)return;const context=audio.current||(audio.current=new Audio());void context.resume();const now=context.currentTime;for(let i=0;i<(celebrate?3:1);i++){const oscillator=context.createOscillator();const volume=context.createGain();oscillator.connect(volume);volume.connect(context.destination);oscillator.frequency.value=[523,659,784][i];volume.gain.setValueAtTime(.07,now+i*.12);volume.gain.exponentialRampToValueAtTime(.001,now+i*.12+.18);oscillator.start(now+i*.12);oscillator.stop(now+i*.12+.2);}}catch{}}
  function changeScale(v:string){setScale(v);try{localStorage.setItem("qe_text_scale",v);}catch{}}
  function changeSound(v:boolean){setSound(v);try{localStorage.setItem("qe_sound",String(v));const Audio=window.AudioContext||(window as any).webkitAudioContext;if(v&&Audio){audio.current||=(new Audio());void audio.current.resume();}}catch{}}
  return {scale,sound,tone,controls:<div className="game-preferences"><label>Tamanho do texto<Select value={scale} onValueChange={changeScale}><SelectTrigger aria-label="Tamanho do texto"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="1">Normal</SelectItem><SelectItem value="1.15">Maior</SelectItem><SelectItem value="1.3">Bem grande</SelectItem></SelectContent></Select></label><label className="sound-toggle"><Switch checked={sound} onCheckedChange={changeSound} aria-label="Ativar sons do jogo"/><span>Sons</span></label></div>};
}
export function QuestionImage({url,alt}:{url?:string;alt?:string}){return url?<img className="question-image" src={url} alt={alt||"Imagem da pergunta"}/>:null;}
