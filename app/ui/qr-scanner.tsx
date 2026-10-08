"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { roomCode } from "@/lib/player-app";

export function QrScanner({open,onClose,onCode}:{open:boolean;onClose:()=>void;onCode:(code:string)=>void}) {
  const video=useRef<HTMLVideoElement>(null);const [error,setError]=useState("");const [ready,setReady]=useState(false);const [attempt,setAttempt]=useState(0);
  const found=useRef(onCode);found.current=onCode;
  useEffect(()=>{
    if(!open)return;
    let alive=true;let stream:MediaStream|undefined;let timer:ReturnType<typeof setTimeout>|undefined;let lastInvalid="";
    setError("");setReady(false);
    const stop=()=>{stream?.getTracks().forEach(track=>track.stop());if(timer)clearTimeout(timer);if(video.current)video.current.srcObject=null;};
    const hidden=()=>{if(document.hidden){alive=false;stop();setReady(false);setError("A câmera foi pausada. Toque em Tentar novamente para continuar.");}};
    document.addEventListener("visibilitychange",hidden);
    async function start() {
      try {
        if(!navigator.mediaDevices?.getUserMedia)throw new Error("Este navegador não pode abrir a câmera. Digite o código da sala.");
        stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280}},audio:false});
        if(!alive){stop();return;}
        const mounted=video.current;if(!mounted)throw new Error("Não foi possível abrir a câmera. Tente novamente ou digite o código da sala.");const element:HTMLVideoElement=mounted;
        element.srcObject=stream;await element.play();
        const {default:decode}=await import("jsqr");if(!alive){stop();return;}
        const canvas=document.createElement("canvas");const context=canvas.getContext("2d",{willReadFrequently:true});if(!context)throw new Error("Não foi possível ler a imagem da câmera. Digite o código da sala.");
        setReady(true);
        function scan() {
          if(!alive)return;
          try { if(element.readyState>=2 && element.videoWidth && element.videoHeight){
            const ratio=Math.min(1,640/Math.max(element.videoWidth,element.videoHeight));canvas.width=Math.round(element.videoWidth*ratio);canvas.height=Math.round(element.videoHeight*ratio);
            context!.drawImage(element,0,0,canvas.width,canvas.height);
            const image=context!.getImageData(0,0,canvas.width,canvas.height);const result=decode(image.data,image.width,image.height,{inversionAttempts:"attemptBoth"});
            if(result){const code=roomCode(result.data,window.location.origin);if(code){alive=false;stop();found.current(code);return;}if(lastInvalid!==result.data){lastInvalid=result.data;setError("Esse QR code não é de uma sala deste Prativerso. Aponte para o código do professor.");}}
          }} catch {alive=false;stop();setReady(false);setError("Não foi possível continuar a leitura. Tente novamente ou digite o código da sala.");return;}
          timer=setTimeout(scan,250);
        }
        scan();
      } catch(reason) {
        stop();if(!alive)return;setReady(false);
        const name=(reason as Error).name;setError(name==="NotAllowedError"?"Permita o uso da câmera no navegador ou digite o código da sala.":name==="NotFoundError"?"Nenhuma câmera foi encontrada. Digite o código da sala.":name==="NotReadableError"?"A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.":name==="Error"?(reason as Error).message:"Não foi possível abrir o leitor. Verifique a conexão ou digite o código da sala.");
      }
    }
    void start();return()=>{alive=false;stop();document.removeEventListener("visibilitychange",hidden);};
  },[open,attempt]);
  return <Dialog open={open} onOpenChange={value=>{if(!value)onClose();}}><DialogContent className="q-dialog scanner-dialog"><DialogTitle>Ler QR code da sala</DialogTitle><DialogDescription>Aponte a câmera para o QR code que o professor está mostrando. A leitura acontece no seu aparelho.</DialogDescription>
    <div className="scanner-camera"><video ref={video} autoPlay muted playsInline aria-label="Câmera para ler o QR code"/>{!ready&&<span><Camera size={32}/><b>{error?"Câmera pausada":"Abrindo a câmera…"}</b></span>}</div>
    {error&&<p className="form-error" role="alert">{error}</p>}<div className="scanner-actions">{error&&<button className="btn btn-outline" onClick={()=>setAttempt(value=>value+1)}><RotateCcw size={17}/>Tentar novamente</button>}<button className="btn btn-primary" onClick={onClose}>Digitar o código</button></div>
  </DialogContent></Dialog>;
}
