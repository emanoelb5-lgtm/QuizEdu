import { env } from "cloudflare:workers";
import { AVATARS, Question, Quiz, quizError, RoomState, scoreFor } from "./quiz";

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export const db = () => { if (!env.DB) throw new HttpError(503, "O serviço está indisponível. Tente novamente em alguns instantes."); return env.DB; };
export function json(value: unknown, status = 200, cookie?: string) { const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" }); if (cookie) headers.set("Set-Cookie", cookie); return new Response(JSON.stringify(value), { status, headers }); }
export function cookieValue(request: Request, name: string) { return (request.headers.get("cookie") || "").split(";").map(s => s.trim()).find(s => s.startsWith(name + "="))?.slice(name.length + 1) || ""; }
export function sessionCookie(request: Request, name: string, secret: string, seconds: number) { return `${name}=${secret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`; }
export async function hash(secret: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)))).map(n => n.toString(16).padStart(2, "0")).join(""); }
function secret() { return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n => n.toString(16).padStart(2, "0")).join(""); }
export type Educator = { id: string; name: string; expires_at: number };
export async function educator(request: Request, required = true) {
  const token = cookieValue(request, "qe_host"); let user: Educator | null = null;
  if (/^[a-f0-9]{64}$/.test(token)) user = await db().prepare("SELECT id, name, expires_at FROM educators WHERE secret_hash = ? AND expires_at > ?").bind(await hash(token), Date.now()).first<Educator>();
  if (!user && required) throw new HttpError(401, "Crie seu acesso temporário para continuar."); return user;
}
export async function body(request: Request) {
  const origin = request.headers.get("Origin"); if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "Esta ação precisa ser feita no QuizEdu.");
  if (!request.headers.get("Content-Type")?.includes("application/json")) throw new HttpError(415, "Formato de envio inválido.");
  if (Number(request.headers.get("Content-Length") || 0) > 65536) throw new HttpError(413, "Este quiz ultrapassou o limite de 64 KB.");
  const raw = await request.text(); if (raw.length > 65536) throw new HttpError(413, "Este quiz ultrapassou o limite de 64 KB.");
  try { const value = JSON.parse(raw); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw new HttpError(400, "Dados de envio inválidos."); }
}
function cleanName(value: unknown, max = 30) { if (typeof value !== "string") throw new HttpError(400, "Digite seu nome."); const name = value.trim().replace(/\s+/g, " ").replace(/[\u0000-\u001f\u007f]/g, ""); if (name.length < 2 || name.length > max) throw new HttpError(400, `Use um nome de 2 a ${max} caracteres.`); return name; }
function validateQuiz(raw: any): Quiz {
  if (typeof raw.id !== "string" || !/^[a-f0-9-]{36}$/.test(raw.id) || typeof raw.title !== "string" || !Array.isArray(raw.questions)) throw new HttpError(400, "O quiz está em um formato inválido.");
  if (raw.questions.some((q: any) => !q || typeof q.text !== "string" || !Array.isArray(q.options) || q.options.some((o: any) => typeof o !== "string") || typeof q.explanation !== "string")) throw new HttpError(400, "Verifique o formato das perguntas.");
  const quiz: Quiz = { id: raw.id, title: raw.title.trim(), questions: raw.questions.map((q: any) => ({ id: typeof q.id === "string" ? q.id.slice(0, 64) : crypto.randomUUID(), text: q.text.trim(), options: q.options.map((o: string) => o.trim()), correct: q.correct, seconds: q.seconds, explanation: q.explanation.trim() })) };
  const error = quizError(quiz); if (error) throw new HttpError(400, error); return quiz;
}
export async function profile(request: Request) {
  const data = await body(request); const name = cleanName(data.name); const user = await educator(request, false);
  if (user) { await db().prepare("UPDATE educators SET name = ? WHERE id = ?").bind(name, user.id).run(); return json({ profile: { name } }); }
  const token = secret(); const now = Date.now();
  await db().prepare("INSERT INTO educators (id, secret_hash, name, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), await hash(token), name, now, now + 30 * 86400000).run();
  return json({ profile: { name } }, 201, sessionCookie(request, "qe_host", token, 30 * 86400));
}
export async function dashboard(request: Request) {
  const user = await educator(request, false); if (!user) return json({ profile: null, quizzes: [], rooms: [] });
  const [q, r] = await db().batch([
    db().prepare("SELECT id, title, questions, updated_at FROM quizzes WHERE owner = ? ORDER BY updated_at DESC").bind(user.id),
    db().prepare("SELECT code, title, status FROM rooms WHERE owner = ? AND status IN ('lobby', 'question', 'results') AND expires_at > ? ORDER BY created_at DESC").bind(user.id, Date.now())
  ]);
  return json({ profile: { name: user.name }, quizzes: q.results.map((row: any) => ({ id: row.id, title: row.title, questions: JSON.parse(row.questions), updatedAt: row.updated_at })), rooms: r.results });
}
export async function saveQuiz(request: Request) {
  const user = (await educator(request))!; const quiz = validateQuiz(await body(request)); const now = Date.now();
  const existing = await db().prepare("SELECT owner FROM quizzes WHERE id = ?").bind(quiz.id).first<{ owner: string }>();
  if (existing && existing.owner !== user.id) throw new HttpError(403, "Este quiz pertence a outro acesso.");
  if (!existing) { const count = await db().prepare("SELECT COUNT(*) n FROM quizzes WHERE owner = ?").bind(user.id).first<{ n: number }>(); if (count!.n >= 50) throw new HttpError(400, "Você pode guardar até 50 quizzes neste acesso. Exporte e exclua um para criar outro."); }
  await db().prepare("INSERT INTO quizzes (id, owner, title, questions, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, questions = excluded.questions, updated_at = excluded.updated_at WHERE quizzes.owner = excluded.owner").bind(quiz.id, user.id, quiz.title, JSON.stringify(quiz.questions), now).run();
  return json({ quiz: { ...quiz, updatedAt: now } });
}
export async function deleteQuiz(request: Request, id: string) { const user = (await educator(request))!; await body(request); const result = await db().prepare("DELETE FROM quizzes WHERE id = ? AND owner = ?").bind(id, user.id).run(); if (!result.meta.changes) throw new HttpError(404, "Quiz não encontrado."); return json({ deleted: true }); }
type RoomRow = { code: string; owner: string; title: string; teacher: string; questions: string; status: RoomState["status"]; question_index: number; starts_at: number | null; ends_at: number | null; expires_at: number; player_count: number; answered_count: number; roster_version: number };
async function getRoom(code: string) { if (!/^\d{6}$/.test(code)) throw new HttpError(404, "Código de sala inválido."); const room = await db().prepare("SELECT * FROM rooms WHERE code = ?").bind(code).first<RoomRow>(); if (!room) throw new HttpError(404, "Sala não encontrada. Confira o código com o professor."); if (room.expires_at <= Date.now()) room.status = "closed"; return room; }
export async function createRoom(request: Request) {
  const user = (await educator(request))!; const data = await body(request); const quiz = await db().prepare("SELECT * FROM quizzes WHERE id = ? AND owner = ?").bind(String(data.quizId || ""), user.id).first<any>();
  if (!quiz) throw new HttpError(404, "Salve seu quiz antes de abrir a sala.");
  const count = await db().prepare("SELECT COUNT(*) n FROM rooms WHERE owner = ? AND status IN ('lobby','question','results') AND expires_at > ?").bind(user.id, Date.now()).first<{ n: number }>();
  if (count!.n >= 5) throw new HttpError(400, "Você já tem 5 salas abertas. Encerre uma para continuar.");
  for (let retry = 0; retry < 8; retry++) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0]; const code = String(100000 + n % 900000); const now = Date.now();
    const result = await db().prepare("INSERT OR IGNORE INTO rooms (code, owner, title, teacher, questions, status, question_index, created_at, expires_at) VALUES (?, ?, ?, ?, ?, 'lobby', -1, ?, ?)").bind(code, user.id, quiz.title, user.name, quiz.questions, now, now + 86400000).run();
    if (result.meta.changes) return json({ code }, 201);
  }
  throw new HttpError(503, "Não foi possível abrir a sala. Tente novamente.");
}
async function playerFor(request: Request, code: string) { const token = cookieValue(request, `qe_player_${code}`); if (!/^[a-f0-9]{64}$/.test(token)) return null; return db().prepare("SELECT id, name, avatar FROM players WHERE room = ? AND secret_hash = ?").bind(code, await hash(token)).first<{ id: string; name: string; avatar: string }>(); }
export async function joinRoom(request: Request, code: string) {
  const data = await body(request); const room = await getRoom(code); const previous = await playerFor(request, code);
  if (previous && room.status !== "closed") return json({ joined: true, id: previous.id });
  if (room.status !== "lobby") throw new HttpError(409, room.status === "closed" || room.status === "finished" ? "Esta sala já foi encerrada." : "O quiz já começou. Aguarde o professor abrir outra sala.");
  const name = cleanName(data.name, 24); if (!AVATARS.includes(data.avatar)) throw new HttpError(400, "Escolha um dos avatares.");
  const token = secret(); const id = crypto.randomUUID();
  try {
    const result = await db().prepare("INSERT INTO players (id, room, secret_hash, name, name_key, avatar, joined_at) SELECT ?, r.code, ?, ?, ?, ?, ? FROM rooms r WHERE r.code = ? AND r.status = 'lobby' AND r.expires_at > ? AND (SELECT COUNT(*) FROM players WHERE room = r.code) < 100").bind(id, await hash(token), name, name.toLocaleLowerCase("pt-BR"), data.avatar, Date.now(), code, Date.now()).run();
    if (!result.meta.changes) throw new HttpError(409, "A sala está cheia ou o quiz já começou.");
  } catch (e) { if (String(e).includes("UNIQUE")) throw new HttpError(409, "Esse nome já está na sala. Use um apelido ou acrescente seu sobrenome."); throw e; }
  return json({ joined: true, id }, 201, sessionCookie(request, `qe_player_${code}`, token, 86400));
}
async function settle(code: string) {
  const now = Date.now(); await db().prepare("UPDATE rooms SET status = 'results' WHERE code = ? AND status = 'question' AND (ends_at <= ? OR (starts_at <= ? AND player_count > 0 AND answered_count >= player_count))").bind(code, now, now).run();
}
export async function roomState(request: Request, code: string) {
  let room = await getRoom(code);
  if (room.status === "question" && ((room.ends_at || 0) <= Date.now() || (room.player_count > 0 && room.answered_count >= room.player_count))) { await settle(code); room = await getRoom(code); }
  const version = `${room.status}:${room.question_index}:${room.roster_version}`;
  if (new URL(request.url).searchParams.get("since") === version) return json({ pulse: true, version, answeredCount: room.answered_count, serverNow: Date.now() });
  const [user, me] = await Promise.all([educator(request, false), playerFor(request, code)]);
  const questions: Question[] = JSON.parse(room.questions); const q = questions[room.question_index] || null; const reveal = ["results", "finished", "closed"].includes(room.status);
  const players = await db().prepare(`SELECT p.id, p.name, p.avatar, p.joined_at,
    COALESCE(SUM(CASE WHEN a.question_index < ? OR (? = 1 AND a.question_index = ?) THEN a.points ELSE 0 END),0) score,
    COALESCE(SUM(CASE WHEN a.question_index < ? OR (? = 1 AND a.question_index = ?) THEN a.correct ELSE 0 END),0) correctCount,
    COALESCE(SUM(CASE WHEN a.correct = 1 AND (a.question_index < ? OR (? = 1 AND a.question_index = ?)) THEN a.elapsed_ms ELSE 0 END),0) totalMs,
    MAX(CASE WHEN a.question_index = ? THEN 1 ELSE 0 END) answered,
    MAX(CASE WHEN a.question_index = ? AND ? = 1 THEN a.points ELSE 0 END) roundPoints,
    MAX(CASE WHEN a.question_index = ? AND ? = 1 THEN a.correct ELSE NULL END) roundCorrect,
    MAX(CASE WHEN a.question_index = ? THEN a.option ELSE NULL END) submittedOption
    FROM players p LEFT JOIN answers a ON a.player = p.id AND a.room = p.room WHERE p.room = ? GROUP BY p.id
    ORDER BY score DESC, correctCount DESC, totalMs ASC, p.joined_at ASC, p.id ASC`).bind(room.question_index, reveal ? 1 : 0, room.question_index, room.question_index, reveal ? 1 : 0, room.question_index, room.question_index, reveal ? 1 : 0, room.question_index, room.question_index, room.question_index, reveal ? 1 : 0, room.question_index, reveal ? 1 : 0, room.question_index, code).all<any>();
  const roster = players.results.map((p: any, i: number) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, correctCount: p.correctCount, totalMs: p.totalMs, position: i + 1, answered: !!p.answered, roundPoints: p.roundPoints, roundCorrect: p.roundCorrect === null ? null : !!p.roundCorrect }));
  const own = me ? players.results.find(p => p.id === me.id) : null; const ownPublic = me ? roster.find(p => p.id === me.id) : null;
  const state: RoomState = { code, title: room.title, teacher: room.teacher, status: room.status, index: room.question_index, total: questions.length, startsAt: room.starts_at, endsAt: room.ends_at, serverNow: Date.now(), question: q ? { id: q.id, text: q.text, options: q.options, seconds: q.seconds } : null, correct: reveal && q ? q.correct : null, explanation: reveal && q ? q.explanation : null, players: roster, answeredCount: room.answered_count, isHost: user?.id === room.owner, me: ownPublic ? { ...ownPublic, option: own?.submittedOption ?? null } : null, expiresAt: room.expires_at, version };
  return json(state);
}
export async function answer(request: Request, code: string) {
  const data = await body(request); const received = Date.now(); const room = await getRoom(code); const me = await playerFor(request, code);
  if (!me) throw new HttpError(401, "Entre na sala antes de responder.");
  if (!Number.isInteger(data.index) || !Number.isInteger(data.option)) throw new HttpError(400, "Resposta inválida.");
  const existing = await db().prepare("SELECT option FROM answers WHERE room = ? AND player = ? AND question_index = ?").bind(code, me.id, data.index).first<{ option: number }>();
  if (existing) { if (existing.option !== data.option) throw new HttpError(409, "Sua resposta já foi enviada e não pode ser alterada."); return json({ accepted: true, option: existing.option }); }
  if (room.status !== "question" || room.question_index !== data.index || !room.starts_at || !room.ends_at || received < room.starts_at || received > room.ends_at) throw new HttpError(409, "O tempo desta pergunta terminou ou a rodada ainda não começou.");
  const q: Question = JSON.parse(room.questions)[room.question_index]; if (data.option < 0 || data.option >= q.options.length) throw new HttpError(400, "Alternativa inválida.");
  const elapsed = Math.max(0, received - room.starts_at); const correct = q.correct === data.option;
  const result = await db().prepare("INSERT OR IGNORE INTO answers (room, player, question_index, option, correct, points, elapsed_ms, received_at) SELECT r.code, ?, ?, ?, ?, ?, ?, ? FROM rooms r WHERE r.code = ? AND r.status = 'question' AND r.question_index = ? AND r.starts_at <= ? AND r.ends_at >= ? AND r.expires_at > ?").bind(me.id, data.index, data.option, correct ? 1 : 0, scoreFor(correct, elapsed, q.seconds * 1000), elapsed, received, code, data.index, received, received, received).run();
  if (!result.meta.changes) { const raced = await db().prepare("SELECT option FROM answers WHERE room = ? AND player = ? AND question_index = ?").bind(code, me.id, data.index).first<{ option: number }>(); if (!raced || raced.option !== data.option) throw new HttpError(409, "Sua resposta não pôde ser registrada nesta rodada."); }
  return json({ accepted: true, option: data.option });
}
export async function controlRoom(request: Request, code: string) {
  const user = (await educator(request))!; const data = await body(request); const room = await getRoom(code);
  if (room.owner !== user.id) throw new HttpError(403, "Somente o professor desta sala pode conduzir o quiz.");
  if (room.status === "closed") throw new HttpError(409, "Esta sala foi encerrada.");
  if (data.action === "kick") {
    if (room.status !== "lobby") throw new HttpError(409, "Só é possível remover participantes antes de iniciar.");
    await db().prepare("DELETE FROM players WHERE id = ? AND room = ? AND EXISTS(SELECT 1 FROM rooms WHERE code = ? AND status = 'lobby')").bind(String(data.playerId), code, code).run(); return roomState(request, code);
  }
  if (data.index !== room.question_index || data.status !== room.status) throw new HttpError(409, "A sala já mudou. Aguarde a atualização da tela.");
  let status: RoomState["status"] = room.status; let index = room.question_index; let startsAt = room.starts_at; let endsAt = room.ends_at;
  const questions: Question[] = JSON.parse(room.questions);
  if (data.action === "start" && room.status === "lobby") {
    const count = await db().prepare("SELECT COUNT(*) n FROM players WHERE room = ?").bind(code).first<{ n: number }>(); if (!count!.n) throw new HttpError(400, "Aguarde pelo menos um participante entrar."); index = 0; status = "question";
  } else if (data.action === "next" && room.status === "results") { if (index + 1 >= questions.length) status = "finished"; else { index++; status = "question"; } }
  else if (data.action === "end_round" && room.status === "question") { status = "results"; }
  else if (data.action === "close") status = "closed";
  else throw new HttpError(409, "Esta ação não está disponível nesta etapa.");
  if (status === "question") { startsAt = Date.now() + 3000; endsAt = startsAt + questions[index].seconds * 1000; }
  const result = await db().prepare("UPDATE rooms SET status = ?, question_index = ?, starts_at = ?, ends_at = ?, answered_count = CASE WHEN ? = 'question' THEN 0 ELSE answered_count END WHERE code = ? AND owner = ? AND status = ? AND question_index = ? AND expires_at > ?").bind(status, index, startsAt, endsAt, status, code, user.id, room.status, room.question_index, Date.now()).run();
  if (!result.meta.changes) throw new HttpError(409, "A sala já mudou. Aguarde a atualização da tela."); return roomState(request, code);
}
