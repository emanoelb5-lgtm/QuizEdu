"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Brand, api } from "./shared";

type Mode = "login" | "register" | "recover" | "password";
export function AccountEntry({ returnTo = "/", initialMode = "login", account }: { returnTo?: string; initialMode?: Mode; account?: { name: string; email: string } }) {
  const [mode, setMode] = useState<Mode>(initialMode), [name, setName] = useState(""), [email, setEmail] = useState(account?.email || "");
  const [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState(""), [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState(""), [savedCode, setSavedCode] = useState(""), [acknowledged, setAcknowledged] = useState(false), [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  function switchMode(value: Mode) { setMode(value); setPassword(""); setConfirmation(""); setCurrentPassword(""); setCode(""); setError(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (mode !== "login" && password !== confirmation) { setError("As senhas precisam ser iguais."); return; }
    setBusy(true);
    try {
      const data = await api<{ recoveryCode?: string }>(`/api/auth/${mode}`, { name, email, password, recoveryCode: code, currentPassword });
      setPassword(""); setConfirmation(""); setCurrentPassword(""); setCode("");
      if (data.recoveryCode) setSavedCode(data.recoveryCode);
      else window.location.assign(returnTo);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function copyCode() { try { await navigator.clipboard.writeText(savedCode); setCopied(true); } catch { setError("Selecione o código abaixo e copie para um lugar seguro."); } }
  const title = mode === "register" ? "Sua próxima aula começa aqui." : mode === "recover" ? "Recupere seu acesso." : mode === "password" ? "Cuide da sua conta." : "Bom ter você por aqui.";
  return <main className="account-page">
    <header className="account-header"><Brand/><a href="/" className="account-back"><ArrowLeft size={17}/>Voltar ao Prativerso</a></header>
    <section className="account-layout">
      <aside className="account-intro"><span className="account-kicker">CONHECIMENTO EM PRÁTICA</span><h1>{title}</h1><p>Suas aulas, quizzes e ideias em um só lugar. Acesse no computador, continue no celular e convide a turma para participar.</p><div className="account-promise"><ShieldCheck size={22}/><span>Uma conta Prativerso para todos os seus dispositivos.</span></div><a className="account-student-link" href="/jogar">Sou aluno: entrar com o código da sala <ArrowRight size={16}/></a></aside>
      <section className="account-card" aria-labelledby="account-title">
        {savedCode ? <>
          <div className="account-key-icon"><KeyRound size={27}/></div><h2 id="account-title">Guarde seu código de recuperação</h2>
          <p>Ele permite criar uma nova senha se você perder o acesso. Salve em um lugar seguro e não compartilhe.</p>
          <code className="account-recovery-code">{savedCode.match(/.{1,8}/g)?.join(" ")}</code>
          <button className="btn btn-outline account-wide" onClick={copyCode}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? "Código copiado" : "Copiar código"}</button>
          <p className="account-note">O código aparece somente agora. Se você recuperou ou alterou a senha, este novo código substitui o anterior e os outros aparelhos precisam entrar novamente.</p>
          <label className="account-ack"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/>Guardei meu código em um lugar seguro.</label>
          <button className="btn btn-primary account-wide" disabled={!acknowledged} onClick={() => window.location.assign(returnTo)}>Continuar para o Prativerso <ArrowRight size={18}/></button>
        </> : <>
          <span className="account-card-label">{mode === "password" ? account?.name : "SUA CONTA PRATIVERSO"}</span>
          <h2 id="account-title">{mode === "register" ? "Criar minha conta" : mode === "recover" ? "Esqueci minha senha" : mode === "password" ? "Alterar senha" : "Entrar"}</h2>
          <p>{mode === "register" ? "Cadastre seu e-mail e escolha uma senha para guardar suas atividades." : mode === "recover" ? "Use o código que você guardou ao criar sua conta." : mode === "password" ? `Conta: ${account?.email}. A alteração também gera um novo código de recuperação.` : "Entre com seu e-mail e senha para continuar."}</p>
          <form className="form-stack account-form" onSubmit={submit}>
            {mode === "register" && <label>Seu nome<input required minLength={2} maxLength={30} autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Como podemos chamar você?"/></label>}
            {mode !== "password" && <label>E-mail<input type="email" required maxLength={254} autoComplete="username" inputMode="email" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com"/></label>}
            {mode === "recover" && <label>Código de recuperação<textarea required rows={3} maxLength={100} autoComplete="off" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} placeholder="Cole o código que você guardou"/></label>}
            {mode === "password" && <label>Senha atual<input type="password" required maxLength={128} autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></label>}
            <label>{mode === "recover" || mode === "password" ? "Nova senha" : "Senha"}<input type="password" required minLength={mode === "login" ? 1 : 12} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "login" ? "Sua senha" : "Pelo menos 12 caracteres"}/></label>
            {mode !== "login" && <label>Repita a {mode === "register" ? "senha" : "nova senha"}<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label>}
            {error && <p className="account-error" role="alert">{error}</p>}
            <button className="btn btn-primary account-wide" disabled={busy}>{busy ? <Loader2 className="spin" size={18}/> : <ArrowRight size={18}/>} {busy ? "Aguarde…" : mode === "register" ? "Criar conta" : mode === "recover" ? "Recuperar acesso" : mode === "password" ? "Salvar nova senha" : "Entrar"}</button>
          </form>
          {mode === "login" && <div className="account-other-actions"><button onClick={() => switchMode("recover")}>Esqueci minha senha</button><span>Ainda não tem conta? <button onClick={() => switchMode("register")}>Criar conta</button></span></div>}
          {(mode === "register" || mode === "recover") && <button className="account-text-button" onClick={() => switchMode("login")}><ArrowLeft size={15}/>Já tenho conta. Entrar</button>}
          {mode === "recover" && <p className="account-note">O código de recuperação não é enviado por e-mail. Sem ele, entre em contato em <a href="/contato">Suporte</a> para orientação.</p>}
          {mode === "password" && <a className="account-text-button" href="/">Voltar às minhas atividades</a>}
          <p className="account-terms">Ao continuar, você concorda com os <a href="/termos">Termos de uso</a> e conhece nossa <a href="/privacidade">Política de privacidade</a>.</p>
        </>}
        {savedCode && error && <p className="account-error" role="alert">{error}</p>}
      </section>
    </section>
  </main>;
}
