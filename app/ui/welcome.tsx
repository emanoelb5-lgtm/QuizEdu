"use client";
import { BarChart3, BookOpen, Check, DoorOpen, MonitorPlay, QrCode, Sparkles, Users } from "lucide-react";
import {ContosExampleCard} from "./contos-example-card";

type WelcomeProps = {
  code: string; busy: boolean; error: string;
  onCode: (value: string) => void; onJoin: () => void; onScan: () => void;
  onPresentation: () => void; onQuiz: () => void; onExample: () => void; onContos?: () => void; onRetry: () => void; onTemporary: () => void;
};

export function Welcome({code,busy,error,onCode,onJoin,onScan,onPresentation,onQuiz,onExample,onContos,onRetry,onTemporary}:WelcomeProps) {
  function focusRoom() {
    const input = document.getElementById("welcome-room-code");
    input?.focus({preventScroll:true});
    document.getElementById("welcome-join")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});
  }
  return <section className="welcome" aria-labelledby="welcome-title">
    <div className="welcome-hero">
      <div className="welcome-intro">
        <p className="welcome-eyebrow"><Sparkles size={17} aria-hidden="true"/>APRENDER PARTICIPANDO</p>
        <h1 id="welcome-title"><span className="welcome-title-line">Conhecimento</span>{" "}<span className="welcome-title-line">em <span className="welcome-title-emphasis">prática.</span></span></h1>
        <p className="welcome-lead">Uma aula ganha vida quando a turma participa.</p>
        <p className="welcome-about">O Prativerso reúne apresentações interativas e quizzes ao vivo. Você prepara o conteúdo, convida a turma e transforma cada resposta em uma oportunidade de aprender.</p>
        <div className="welcome-hero-actions"><a className="btn btn-primary" href="#welcome-create">Criar uma atividade</a><button className="btn btn-outline" onClick={focusRoom}>Tenho um código de sala</button></div>
        <p className="welcome-intro-note"><Users size={18} aria-hidden="true"/>Para educadores, estudantes e pessoas curiosas.</p><div className="welcome-temporary-access"><button onClick={onTemporary}>Começar com conta temporária</button><span>Sem senha · basta seu nome</span></div>
      </div>
      <aside className="welcome-preview" aria-labelledby="welcome-preview-title">
        <div className="welcome-preview-heading"><span><MonitorPlay size={19} aria-hidden="true"/>DO CONTEÚDO À DESCOBERTA</span><span className="welcome-preview-label">Exemplo</span></div>
        <div className="welcome-preview-card">
          <div className="welcome-preview-image"><img src="/examples/palhada.jpg" width={1200} height={675} alt="Palhada protegendo o solo ao redor de plantas em uma horta." fetchPriority="high"/><span>AGROECOLOGIA</span></div>
          <div className="welcome-preview-content"><p className="welcome-preview-kicker">Observe. Pense. Participe.</p><h2 id="welcome-preview-title">Qual prática ajuda a proteger o solo da erosão?</h2>
            <ul className="welcome-preview-answers" aria-label="Exemplo de pergunta com resposta comentada"><li><span>A</span>Deixar o solo descoberto</li><li className="welcome-preview-correct"><span>B</span>Manter a cobertura vegetal<Check size={18} aria-label="Resposta correta"/></li></ul>
            <p className="welcome-preview-feedback"><Check size={17} aria-hidden="true"/><span>A cobertura reduz o impacto da chuva e ajuda a conservar o solo.</span></p>
          </div>
        </div>
        <div className="welcome-preview-caption"><span><MonitorPlay size={17} aria-hidden="true"/>Apresente na tela</span><span><Users size={17} aria-hidden="true"/>A turma responde</span></div>
      </aside>
    </div>
    <section className="welcome-how" aria-labelledby="welcome-how-title">
      <div className="welcome-section-heading"><p className="welcome-eyebrow">SIMPLES DE COMEÇAR</p><h2 id="welcome-how-title">Sua ideia. A turma em ação.</h2><p>Mais participação em três passos.</p></div>
      <ol className="welcome-steps">
        <li><span className="welcome-step-icon"><MonitorPlay size={24} aria-hidden="true"/></span><div><span className="welcome-step-number">01 · PREPARE</span><h3>Dê forma à sua aula</h3><p>Crie slides, importe uma apresentação ou organize perguntas em um quiz.</p></div></li>
        <li><span className="welcome-step-icon"><QrCode size={24} aria-hidden="true"/></span><div><span className="welcome-step-number">02 · CONVIDE</span><h3>Traga todo mundo</h3><p>Compartilhe o código ou QR code. A turma participa pelo celular, sem precisar de conta.</p></div></li>
        <li><span className="welcome-step-icon"><BarChart3 size={24} aria-hidden="true"/></span><div><span className="welcome-step-number">03 · ACOMPANHE</span><h3>Veja o aprendizado acontecer</h3><p>Apresente, receba as respostas e use os resultados para conversar e retomar o conteúdo.</p></div></li>
      </ol>
    </section>
    <div className="welcome-start-heading"><h2>Crie ou participe<span className="title-dot">.</span></h2><p>Escolha como você quer entrar nessa experiência.</p></div>
    {error&&<div className="error-panel" role="alert"><p>{error}</p><button className="btn btn-outline" onClick={onRetry}>Tentar novamente</button></div>}
    <div className="welcome-choices">
      <section id="welcome-create" className="welcome-create" aria-labelledby="welcome-create-title">
        <div className="welcome-card-heading"><span className="welcome-icon"><MonitorPlay size={25}/></span><h2 id="welcome-create-title">Criar uma atividade</h2></div>
        <p className="welcome-description">Apresentações e perguntas para aprender juntos.</p>
        <div className="welcome-create-actions"><a className="welcome-action" href="/aulas-prontas"><BookOpen size={24}/><span><b>Aulas prontas por disciplina</b><small>Encontre uma aula e adapte para sua turma</small></span></a>
          <button className="welcome-action" disabled={busy} onClick={onPresentation}><MonitorPlay size={24}/><span><b>Nova apresentação</b><small>Slides com perguntas ao vivo</small></span></button>
          <button className="welcome-action" disabled={busy} onClick={onQuiz}><BookOpen size={24}/><span><b>Novo quiz</b><small>Perguntas, respostas e pontuação</small></span></button>
        </div>
        <button className="welcome-example" disabled={busy} onClick={onExample}><Sparkles size={17}/>Usar um quiz de exemplo</button>
      </section>
      <section id="welcome-join" className="welcome-join" aria-labelledby="welcome-join-title">
        <div className="welcome-card-heading"><span className="welcome-icon"><Users size={25}/></span><h2 id="welcome-join-title">Entrar em uma sala</h2></div>
        <p className="welcome-description">Sua turma já está por aqui? Use o código de quem abriu a sala.</p>
        <form onSubmit={event=>{event.preventDefault();onJoin();}} className="welcome-join-form">
          <label htmlFor="welcome-room-code">Código da sala</label>
          <input id="welcome-room-code" className="code-input" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={event=>onCode(event.target.value.replace(/\D/g,"").slice(0,6))} aria-describedby="welcome-room-help" required/>
          <button type="submit" className="btn btn-primary" disabled={code.length!==6}><DoorOpen size={19}/>Entrar na sala</button>
          <button type="button" className="btn btn-outline" onClick={onScan}><QrCode size={19}/>Ler QR code</button>
          <p className="welcome-room-help" id="welcome-room-help">Para participar, você não precisa de conta.</p>
        </form>
      </section>
    </div>
    {onContos&&<section className="welcome-contos" aria-labelledby="welcome-contos-title"><h2 id="welcome-contos-title">Uma atividade pronta para experimentar</h2><ContosExampleCard busy={busy} onUse={onContos} headingLevel={3}/></section>}
    <footer className="welcome-footer"><span>Prativerso <span aria-hidden="true">·</span> Conhecimento em prática.</span><a href="https://github.com/emanoelb5-lgtm/QuizEdu/releases/latest" target="_blank" rel="noreferrer">Baixar aplicativo Android</a><span>Aprender. Praticar. Evoluir.</span></footer>
  </section>;
}
