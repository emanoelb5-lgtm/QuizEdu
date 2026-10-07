"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { Download, LoaderCircle, LogOut, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { leaveActiveRoom } from "@/lib/player-app";
import type { AppInstallState } from "@/lib/app-install";

const InstallContext = createContext<AppInstallState & {install:()=>void;showHelp:()=>void}>({status:"waiting",ios:false,install:()=>{},showHelp:()=>{}});

export function PlayerAppProvider({children}:{children:React.ReactNode}) {
  const [installation,setInstallation] = useState<AppInstallState>({status:"waiting",ios:false});
  const [help,setHelp] = useState(false);
  useEffect(()=>{
    const installer = window.__quizEduInstall;
    const update = () => {
      const state = installer?.getState() || {status:"manual" as const,ios:false};
      setInstallation(state);
      if (state.status === "installed") setHelp(false);
    };
    const unsubscribe = installer?.subscribe(update);
    update();
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{});
    return unsubscribe;
  },[]);
  function install() {
    void window.__quizEduInstall?.install();
  }
  return <InstallContext.Provider value={{...installation,install,showHelp:()=>setHelp(true)}}>{children}
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="q-dialog install-dialog"><DialogTitle>Coloque o QuizEdu na tela inicial</DialogTitle><DialogDescription>Abra pelo ícone do app para voltar à sua sala mesmo depois de fechar o navegador.</DialogDescription>
      <p className="install-note">{installation.ios?"No iPhone e no iPad, a instalação é feita pelo menu do navegador.":"Se este endereço abriu dentro de outro aplicativo, abra-o no Chrome, Edge ou Samsung Internet para instalar."}</p>
      <ol className="install-steps">{installation.ios?<><li>Abra o menu <b>Compartilhar</b> do navegador. Se a opção não aparecer, abra este endereço no Safari.</li><li>Toque em <b>Adicionar à Tela de Início</b> e confirme <b>Adicionar</b>.</li></>:<><li>Abra o menu do navegador, geralmente indicado por <b>⋮</b>.</li><li>Escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b> e confirme.</li></>}<li>Depois, abra o ícone <b>QuizEdu</b> no celular.</li></ol>
      <p className="install-note">A instalação é opcional. O quiz também funciona no navegador.</p><button className="btn btn-primary" onClick={()=>setHelp(false)}>Entendi</button>
    </DialogContent></Dialog>
  </InstallContext.Provider>;
}

export function usePlayerManifest(code?:string,playerId?:string) {
  useEffect(()=>{
    const link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const params=new URLSearchParams();if(code)params.set("sala",code);if(playerId)params.set("acesso",playerId);
    // The personal start URL needs the student's cookie, including on the
    // same origin. Avoid restarting installability checks for unchanged URLs.
    link.crossOrigin="use-credentials";
    const href=`/api/app-manifest${params.size?`?${params}`:""}`;
    if (link.getAttribute("href") !== href) link.setAttribute("href",href);
  },[code,playerId]);
}
export function AppInstallButton({compact=false}:{compact?:boolean}) {
  const {status,install}=useContext(InstallContext);
  if (!["ready","waiting","prompting"].includes(status) || (compact && status === "waiting")) return null;
  const ready=status === "ready";
  return <button type="button" className={`btn ${compact?"btn-quiet player-install-small":"btn-primary"}`} disabled={!ready} onClick={install} aria-label={ready?"Instalar QuizEdu":status === "prompting"?"Confirme a instalação no navegador":"Preparando instalação"} aria-busy={!ready}>{ready?<Download size={18}/>:<LoaderCircle className="install-spinner" size={18}/>}<span>{ready?(compact?"Instalar":"Instalar QuizEdu"):status === "prompting"?"Confirme no navegador":"Preparando instalação"}</span></button>;
}
export function AppInstallCard() {
  const {status,ios,showHelp}=useContext(InstallContext);
  if(status === "installed")return null;
  const message=status === "waiting"?"O botão será liberado assim que o navegador estiver pronto.":status === "prompting"?"Confirme a instalação na janela do navegador.":status === "dismissed"?"Instalação cancelada. Você pode continuar o quiz ou instalar pelo menu.":status === "error"?"A janela de instalação não abriu. Atualize a página ou instale pelo menu.":status === "manual"?(ios?"No iPhone e no iPad, adicione o app pelo menu Compartilhar.":"Abra no Chrome, Edge ou Samsung Internet para usar a instalação do app."):"";
  return <aside className="player-install-card"><span className="install-card-icon"><Smartphone size={25}/></span><div><b>Fechou? Volte pelo app.</b><p>Instale o QuizEdu para encontrar sua sala na tela inicial.</p><AppInstallButton/><p className="install-status" role="status" aria-live="polite">{message}</p>{status !== "prompting" && <button type="button" className="btn btn-quiet install-help" onClick={showHelp}>Como instalar pelo menu</button>}</div></aside>;
}
export function ExitRoomButton({code,onExit}:{code:string;onExit?:()=>void}) {
  const [open,setOpen]=useState(false);
  function leave() {onExit?.();try{leaveActiveRoom(localStorage,code);}catch{}window.location.replace("/jogar?trocar=1");}
  return <><button type="button" className="btn btn-quiet player-exit" onClick={()=>setOpen(true)}><LogOut size={17}/>Sair</button>
    <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent className="q-dialog"><AlertDialogTitle>Sair desta sala?</AlertDialogTitle><AlertDialogDescription>Você poderá entrar em outra sala por código ou QR code. Seus pontos continuam guardados nesta partida; para voltar, use este mesmo aparelho.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Continuar na sala</AlertDialogCancel><AlertDialogAction onClick={leave}>Sair da sala</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
