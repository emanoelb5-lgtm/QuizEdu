"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, CircleHelp, Clock3, Copy, DoorOpen, Edit3, GraduationCap, Loader2, Play, Plus, QrCode, Sparkles, Trash2, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { api, Brand, Loading, Notifications } from "./shared";
import { newQuiz, Quiz, sampleQuiz } from "@/lib/quiz";
import { Editor } from "./editor";

type Profile = { name: string } | null;
type Room = { code: string; title: string; status: string };
export function Dashboard() {
  const [profile, setProfile] = useState<Profile>(null); const [quizzes, setQuizzes] = useState<Quiz[]>([]); const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [editor, setEditor] = useState<Quiz | null>(null);
  const [profileOpen, setProfileOpen] = useState(false); const [joinOpen, setJoinOpen] = useState(false); const [name, setName] = useState(""); const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false); const [deleting, setDeleting] = useState<Quiz | null>(null); const afterProfile = useRef<(() => void) | null>(null);
  async function refresh() {
    try { const data = await api<{ profile: Profile; quizzes: Quiz[]; rooms: Room[] }>("/api/dashboard"); setProfile(data.profile); setQuizzes(data.quizzes); setRooms(data.rooms); setError(""); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  function needProfile(action: () => void) { if (profile) action(); else { afterProfile.current = action; setProfileOpen(true); } }
  function create(example = false) { needProfile(() => setEditor(example ? sampleQuiz() : newQuiz())); }
  async function register(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { const data = await api<{ profile: Profile }>("/api/profile", { name }); setProfile(data.profile); setProfileOpen(false); afterProfile.current?.(); afterProfile.current = null; }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function openRoom(quiz: Quiz) {
    setBusy(true); try { const room = await api<{ code: string }>("/api/rooms", { quizId: quiz.id }); window.location.assign(`/sala/${room.code}`); }
    catch (e) { toast.error((e as Error).message); setBusy(false); }
  }
  async function duplicate(quiz: Quiz) {
    setBusy(true); try { await api("/api/quizzes", { ...quiz, id: crypto.randomUUID(), title: `${quiz.title.slice(0, 90)} · cópia` }); await refresh(); toast.success("Cópia criada."); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting) return; setBusy(true);
    try { await api(`/api/quizzes/${deleting.id}`, {}, "DELETE"); await refresh(); toast.success("Quiz excluído."); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); setDeleting(null); }
  }
  useEffect(() => {
    const context = (document as any).modelContext; if (!context?.registerTool) return;
    const life = new AbortController();
    const definitions = [
      { name: "read_my_quizzes", title: "Consultar meus quizzes", description: "Lista os quizzes salvos neste acesso temporário.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: async () => { const data = await api("/api/dashboard"); setQuizzes(data.quizzes); return { quizzes: data.quizzes.map((q: Quiz) => ({ id: q.id, title: q.title, questionCount: q.questions.length })) }; } },
      { name: "start_quiz_creation", title: "Preparar novo quiz", description: "Abre o editor de um novo quiz. Não salva nem abre uma sala.", inputSchema: { type: "object", properties: { title: { type: "string", minLength: 1, maxLength: 100 } }, required: ["title"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async (input: any) => { if (!profile) throw new Error("Crie primeiro seu acesso temporário."); if (typeof input?.title !== "string" || !input.title.trim() || input.title.length > 100) throw new Error("Título inválido."); const quiz = { ...newQuiz(), title: input.title.trim() }; setEditor(quiz); return { status: "editor_open", id: quiz.id, title: quiz.title }; } }
    ];
    for (const tool of definitions) { try { Promise.resolve(context.registerTool(tool, { signal: life.signal })).catch(() => {}); } catch {} }
    return () => life.abort();
  }, [profile]);

  if (editor) return <><Editor initial={editor} onBack={() => { setEditor(null); void refresh(); }} onSaved={() => { void refresh(); }} onRoom={openRoom} /><Notifications /></>;
  return <div className="app-shell">
    <header className="topbar"><Brand /><nav className="top-actions"><button className="btn btn-quiet" onClick={() => setJoinOpen(true)}><QrCode size={18} />Entrar em uma sala</button><button className="profile-chip" onClick={() => { afterProfile.current = null; setName(profile?.name || ""); setProfileOpen(true); }}><span className="profile-initial">{profile ? Array.from(profile.name)[0].toLocaleUpperCase() : <GraduationCap size={18} />}</span><span>{profile?.name || "Sou educador"}<small>{profile ? "Acesso temporário" : "Começar sem cadastro"}</small></span></button></nav></header>
    <main className="workspace">
      <div className="page-heading"><div><p className="eyebrow">ESPAÇO DO EDUCADOR</p><h1>Meus quizzes<span className="title-dot">.</span></h1><p className="muted">Uma pergunta. Muitas descobertas. Sua turma no jogo.</p></div><button className="btn btn-primary" onClick={() => create()}><Plus size={20} />Criar quiz</button></div>
      {error && <div className="error-panel" role="alert"><p>{error}</p><button className="btn btn-outline" onClick={refresh}>Tentar novamente</button></div>}
      {rooms.length > 0 && <div className="active-rooms">{rooms.map(r => <a href={`/sala/${r.code}`} key={r.code}><span className="live-dot" /><span><b>Sala {r.code}</b> · {r.title}</span><span className="resume">Retomar sala <DoorOpen size={18} /></span></a>)}</div>}
      <div className="dashboard-grid">
        <section className="quiz-library" aria-label="Seus quizzes">
          {loading ? <Loading label="Carregando seus quizzes…" /> : <div className="quiz-grid">{quizzes.map((quiz, i) => <article className="quiz-card" key={quiz.id}><div className={`quiz-cover cover-${i % 3}`}><span className="cover-label">QUIZ AO VIVO</span><BookOpen size={52} strokeWidth={1.5} /><span className="cover-number">{String(quiz.questions.length).padStart(2, "0")}</span></div><div className="quiz-card-body"><h2>{quiz.title}</h2><p className="quiz-meta"><CircleHelp size={16} />{quiz.questions.length} {quiz.questions.length === 1 ? "pergunta" : "perguntas"}<span>·</span><Clock3 size={16} />{Math.ceil(quiz.questions.reduce((s, q) => s + q.seconds, 0) / 60)} min de respostas</p><div className="card-primary-actions"><button className="btn btn-primary" disabled={busy} onClick={() => openRoom(quiz)}><Play size={16} fill="currentColor" />Abrir sala</button><button className="btn btn-outline" onClick={() => setEditor(quiz)}><Edit3 size={16} />Editar</button></div><div className="card-secondary-actions"><button onClick={() => duplicate(quiz)} disabled={busy}><Copy size={15} />Duplicar</button><button onClick={() => setDeleting(quiz)} disabled={busy} aria-label={`Excluir ${quiz.title}`}><Trash2 size={15} /></button></div></div></article>)}
            <button className="new-quiz-card" onClick={() => create()}><span className="new-quiz-icon"><Plus size={30} /></span><b>{quizzes.length ? "Criar outro quiz" : "Seu primeiro quiz"}</b><span>Adicione perguntas, marque as respostas<br />e convide a turma.</span><span className="small-action">Criar do zero</span></button>
          </div>}
          <div className="example-card"><div className="example-icon"><Sparkles size={25} /></div><div><span className="eyebrow">COMECE COM UM EXEMPLO</span><h2>Brasil e natureza</h2><p>5 perguntas prontas para experimentar com a turma.</p></div><button className="btn btn-outline" onClick={() => create(true)}>Usar este quiz</button></div>
          <div className="scoring-note"><Zap size={19} /><p><b>Acertar vem primeiro.</b> Cada acerto vale 500 pontos + até 500 pela rapidez. O placar soma todas as rodadas.</p></div>
        </section>
        <aside className="how-card"><span className="badge badge-lime">DO SEU JEITO, AO VIVO</span><h2>Da pergunta<br />ao jogo<span>.</span></h2><ol className="steps"><li><span>01</span><div><b>Prepare seu quiz</b><p>Escreva as perguntas, as alternativas e escolha o tempo.</p></div></li><li><span>02</span><div><b>Reúna a turma</b><p>Abra uma sala. Cada aluno entra pelo QR code ou pelo código.</p></div></li><li><span>03</span><div><b>Solte a primeira pergunta</b><p>Você conduz as rodadas. A turma responde no próprio celular.</p></div></li></ol><div className="how-footer"><Users size={21} /><span>Até 100 participantes por sala.<br /><b>Sem conta para os alunos.</b></span></div></aside>
      </div>
      <footer className="site-footer"><span>QuizEdu <span>·</span> Feito para aprender juntos</span><span><Check size={15} />Sem assinatura no aplicativo</span></footer>
    </main>
    <Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogContent className="q-dialog" showCloseButton={false}><DialogClose asChild><button className="dialog-close-button" aria-label="Fechar janela"><X size={20} /></button></DialogClose><DialogTitle className="dialog-title">Vamos preparar sua aula?</DialogTitle><DialogDescription>Crie seu acesso temporário. Só precisamos de um nome.</DialogDescription><form onSubmit={register} className="form-stack"><label htmlFor="teacher-name">Como podemos chamar você?</label><input id="teacher-name" autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={30} required minLength={2} placeholder="Ex.: Professor Emanuel" /><p className="field-help">Seu acesso fica salvo por 30 dias neste navegador. Guarde seus quizzes usando o botão de exportação no editor.</p><button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <GraduationCap size={19} />}{profile ? "Salvar nome" : "Entrar como educador"}</button></form></DialogContent></Dialog>
    <Dialog open={joinOpen} onOpenChange={setJoinOpen}><DialogContent className="q-dialog" showCloseButton={false}><DialogClose asChild><button className="dialog-close-button" aria-label="Fechar janela"><X size={20} /></button></DialogClose><DialogTitle className="dialog-title">Entre no jogo</DialogTitle><DialogDescription>Digite o código de 6 números que aparece na tela do professor.</DialogDescription><form className="form-stack" onSubmit={e => { e.preventDefault(); if (code.length === 6) window.location.assign(`/participar/${code}`); }}><label htmlFor="room-code">Código da sala</label><input className="code-input" id="room-code" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required /><button className="btn btn-primary" disabled={code.length !== 6}>Entrar na sala</button></form></DialogContent></Dialog>
    <AlertDialog open={!!deleting} onOpenChange={v => { if (!v) setDeleting(null); }}><AlertDialogContent className="q-dialog"><AlertDialogTitle>Excluir este quiz?</AlertDialogTitle><AlertDialogDescription>“{deleting?.title}” será excluído dos seus quizzes. Salas já abertas continuam com suas perguntas.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="btn-danger" onClick={remove}>Excluir quiz</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Notifications />
  </div>;
}
