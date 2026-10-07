"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Download, LogOut, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { leaveActiveRoom } from "@/lib/player-app";

type InstallPrompt = Event & { prompt: () => Promise<unknown>; userChoice: Promise<{outcome:string}> };
const InstallContext = createContext({installed:false,install:()=>{}});

export function PlayerAppProvider({children}:{children:React.ReactNode}) {
  const [installed,setInstalled] = useState(false);
  const [help,setHelp] = useState(false);
  const [ios,setIos] = useState(false);
  const deferred = useRef<InstallPrompt | null>(null);
  useEffect(()=>{
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(media.matches || !!(navigator as Navigator & {standalone?:boolean}).standalone);
    update();setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const available = (event:Event) => {event.preventDefault();deferred.current=event as InstallPrompt;};
    const complete = () => {deferred.current=null;setInstalled(true);setHelp(false);};
    window.addEventListener("beforeinstallprompt",available);window.addEventListener("appinstalled",complete);media.addEventListener?.("change",update);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{});
    return()=>{window.removeEventListener("beforeinstallprompt",available);window.removeEventListener("appinstalled",complete);media.removeEventListener?.("change",update);};
  },[]);
  function install() {
    const event=deferred.current;
    if (!event) {setHelp(true);return;}
    deferred.current=null;
    void event.prompt().then(()=>event.userChoice).then(result=>{if(result.outcome==="accepted")setInstalled(true);}).catch(()=>setHelp(true));
  }
  return <InstallContext.Provider value={{installed,install}}>{children}
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="q-dialog install-dialog"><DialogTitle>Coloque o QuizEdu na tela inicial</DialogTitle><DialogDescription>Abra pelo ícone do app para voltar à sua sala mesmo depois de fechar o navegador.</DialogDescription>
      <ol className="install-steps">{ios?<><li>Abra o menu <b>Compartilhar</b> do navegador. Se a opção não aparecer, abra este endereço no Safari.</li><li>Toque em <b>Adicionar à Tela de Início</b> e confirme <b>Adicionar</b>.</li></>:<><li>Abra o menu do navegador, geralmente indicado por <b>⋮</b>.</li><li>Escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b> e confirme.</li></>}<li>Depois, abra o ícone <b>QuizEdu</b> no celular.</li></ol>
      <p className="install-note">A instalação é opcional. O quiz também funciona no navegador.</p><button className="btn btn-primary" onClick={()=>setHelp(false)}>Entendi</button>
    </DialogContent></Dialog>
  </InstallContext.Provider>;
}

export function usePlayerManifest(code?:string,playerId?:string) {
  useEffect(()=>{
    const link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const params=new URLSearchParams();if(code)params.set("sala",code);if(playerId)params.set("acesso",playerId);
    link.href=`/api/app-manifest${params.size?`?${params}`:""}`;
  },[code,playerId]);
}
export function AppInstallButton({compact=false}:{compact?:boolean}) {
  const {installed,install}=useContext(InstallContext);
  if (installed) return null;
  return <button type="button" className={`btn ${compact?"btn-quiet player-install-small":"btn-primary"}`} onClick={install} aria-label="Instalar QuizEdu"><Download size={18}/><span>{compact?"Instalar":"Instalar QuizEdu"}</span></button>;
}
export function AppInstallCard() {
  const {installed}=useContext(InstallContext);
  if(installed)return null;
  return <aside className="player-install-card"><span className="install-card-icon"><Smartphone size={25}/></span><div><b>Fechou? Volte pelo app.</b><p>Instale o QuizEdu para encontrar sua sala na tela inicial.</p><AppInstallButton/></div></aside>;
}
export function ExitRoomButton({code,onExit}:{code:string;onExit?:()=>void}) {
  const [open,setOpen]=useState(false);
  function leave() {onExit?.();try{leaveActiveRoom(localStorage,code);}catch{}window.location.replace("/jogar?trocar=1");}
  return <><button type="button" className="btn btn-quiet player-exit" onClick={()=>setOpen(true)}><LogOut size={17}/>Sair</button>
    <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent className="q-dialog"><AlertDialogTitle>Sair desta sala?</AlertDialogTitle><AlertDialogDescription>Você poderá entrar em outra sala por código ou QR code. Seus pontos continuam guardados nesta partida; para voltar, use este mesmo aparelho.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Continuar na sala</AlertDialogCancel><AlertDialogAction onClick={leave}>Sair da sala</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
