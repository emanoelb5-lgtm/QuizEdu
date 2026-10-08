"use client";
import { BookOpen, DoorOpen, MonitorPlay, QrCode, Sparkles, Users } from "lucide-react";

type WelcomeProps = {
  code: string; busy: boolean; error: string;
  onCode: (value: string) => void; onJoin: () => void; onScan: () => void;
  onPresentation: () => void; onQuiz: () => void; onExample: () => void; onRetry: () => void;
};

export function Welcome({code,busy,error,onCode,onJoin,onScan,onPresentation,onQuiz,onExample,onRetry}:WelcomeProps) {
  return <section className="welcome" aria-labelledby="welcome-title">
    <h1 id="welcome-title">Crie ou participe<span className="title-dot">.</span></h1>
    {error&&<div className="error-panel" role="alert"><p>{error}</p><button className="btn btn-outline" onClick={onRetry}>Tentar novamente</button></div>}
    <div className="welcome-choices">
      <section className="welcome-create" aria-labelledby="welcome-create-title">
        <div className="welcome-card-heading"><span className="welcome-icon"><MonitorPlay size={25}/></span><h2 id="welcome-create-title">Criar uma atividade</h2></div>
        <p className="welcome-description">Apresentações e perguntas para aprender juntos.</p>
        <div className="welcome-create-actions">
          <button className="welcome-action" disabled={busy} onClick={onPresentation}><MonitorPlay size={24}/><span><b>Nova apresentação</b><small>Slides com perguntas ao vivo</small></span></button>
          <button className="welcome-action" disabled={busy} onClick={onQuiz}><BookOpen size={24}/><span><b>Novo quiz</b><small>Perguntas, respostas e pontuação</small></span></button>
        </div>
        <button className="welcome-example" disabled={busy} onClick={onExample}><Sparkles size={17}/>Usar um quiz de exemplo</button>
      </section>
      <section className="welcome-join" aria-labelledby="welcome-join-title">
        <div className="welcome-card-heading"><span className="welcome-icon"><Users size={25}/></span><h2 id="welcome-join-title">Entrar em uma sala</h2></div>
        <form onSubmit={event=>{event.preventDefault();onJoin();}} className="welcome-join-form">
          <label htmlFor="welcome-room-code">Código da sala</label>
          <input id="welcome-room-code" className="code-input" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={event=>onCode(event.target.value.replace(/\D/g,"").slice(0,6))} aria-describedby="welcome-room-help" required/>
          <button type="submit" className="btn btn-primary" disabled={code.length!==6}><DoorOpen size={19}/>Entrar na sala</button>
          <button type="button" className="btn btn-outline" onClick={onScan}><QrCode size={19}/>Ler QR code</button>
          <p className="welcome-room-help" id="welcome-room-help">Para participar, você não precisa de conta.</p>
        </form>
      </section>
    </div>
  </section>;
}
