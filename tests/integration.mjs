import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

// Runs the built production Worker against an isolated, disposable D1 database.
// No browser, cloud account, real students or production database is involved.
const require = createRequire(import.meta.resolve("wrangler"));
const { Miniflare } = require("miniflare");
const origin = "https://quizedu.test";
async function walk(directory) { const out = []; for (const entry of await fs.readdir(directory, { withFileTypes: true })) { const file = path.join(directory, entry.name); if (entry.isDirectory()) out.push(...await walk(file)); else if (/\.m?js$/.test(file)) out.push(file); } return out; }
const entrypoint = path.resolve("dist/server/index.js");
const modules = [entrypoint, ...(await walk(path.resolve("dist/server"))).filter(p => p !== entrypoint)].map(p => ({ type: "ESModule", path: p }));
const mf = new Miniflare({ modules, modulesRoot: path.resolve("dist/server"), compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], d1Databases: { DB: "quizedu-test" } });
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function eq(actual, expected, message) { assert.deepEqual(actual, expected, message); checks++; }
class Client {
  cookies = new Map();
  async request(route, body, expected = 200, method) {
    const response = await mf.dispatchFetch(origin + route, { method: method || (body === undefined ? "GET" : "POST"), headers: { cookie: [...this.cookies].map(([k,v]) => `${k}=${v}`).join("; "), ...(body === undefined ? {} : { "content-type": "application/json", Origin: origin }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0]; const at = pair.indexOf("="); this.cookies.set(pair.slice(0,at), pair.slice(at+1)); }
    const text = await response.text(); let value; try { value = JSON.parse(text); } catch { value = text; }
    eq(response.status, expected, `${route}: ${typeof value === "object" ? JSON.stringify(value) : text.slice(0,120)}`); return value;
  }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const database = await mf.getD1Database("DB");
  for (const file of (await fs.readdir("drizzle")).filter(f => f.endsWith(".sql")).sort()) {
    const sql = await fs.readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await database.prepare(statement).run();
  }
  const anonymous = new Client(); const host = new Client(); const stranger = new Client();
  const landing = await anonymous.request("/"); check(landing.includes("Meus quizzes") && landing.includes('lang="pt-BR"'), "The educator workspace renders in Portuguese.");
  const guest = await anonymous.request("/api/dashboard"); eq(guest.profile, null); eq(guest.quizzes, []);
  await anonymous.request("/api/quizzes", {}, 401);
  await host.request("/api/profile", { name: "Professor Emanuel" }, 201); check(host.cookies.has("qe_host"), "Host gets an opaque session cookie.");
  await stranger.request("/api/profile", { name: "Outra pessoa" }, 201);
  const quiz = { id: crypto.randomUUID(), title: "Integração ao vivo", questions: Array.from({ length: 3 }, (_, i) => ({ id: crypto.randomUUID(), text: `Pergunta ${i + 1}`, options: ["Correta", "Incorreta", "Alternativa C", "Alternativa D"], correct: 0, seconds: 10, explanation: "A primeira alternativa é a correta." })) };
  await host.request("/api/quizzes", { ...quiz, questions: [{ ...quiz.questions[0], options: ["igual", "igual"] }] }, 400);
  const saved = await host.request("/api/quizzes", quiz); eq(saved.quiz.questions.length, 3);
  const dash = await host.request("/api/dashboard"); eq(dash.quizzes[0].id, quiz.id);
  eq((await stranger.request("/api/dashboard")).quizzes.length, 0, "Other educator cannot read quizzes.");
  await stranger.request("/api/quizzes", quiz, 403);
  await stranger.request(`/api/quizzes/${quiz.id}`, {}, 404, "DELETE");
  const { code } = await host.request("/api/rooms", { quizId: quiz.id }, 201);
  let state = await host.request(`/api/rooms/${code}`); eq(state.status, "lobby"); check(state.isHost, "Host is authorized."); eq(state.question, null);
  await host.request(`/api/rooms/${code}/control`, { action: "start", status: "lobby", index: -1 }, 400);
  const alice = new Client(), bob = new Client(), carol = new Client(), duplicate = new Client(), kicked = new Client();
  await alice.request(`/api/rooms/${code}/join`, { name: "Alice", avatar: "🦊" }, 201);
  await bob.request(`/api/rooms/${code}/join`, { name: "Bob", avatar: "🐼" }, 201);
  await carol.request(`/api/rooms/${code}/join`, { name: "Carol", avatar: "🐸" }, 201);
  await duplicate.request(`/api/rooms/${code}/join`, { name: "ALICE", avatar: "🐝" }, 409);
  await duplicate.request(`/api/rooms/${code}/join`, { name: "Invalid avatar", avatar: "bad" }, 400);
  const kick = await kicked.request(`/api/rooms/${code}/join`, { name: "Removido", avatar: "🐧" }, 201);
  state = await host.request(`/api/rooms/${code}`); eq(state.players.length, 4); const oldVersion = state.version;
  await host.request(`/api/rooms/${code}/control`, { action: "kick", playerId: kick.id });
  state = await host.request(`/api/rooms/${code}`); eq(state.players.length, 3); check(state.version !== oldVersion, "Roster version changes after a removal.");
  const pulse = await anonymous.request(`/api/rooms/${code}?since=${encodeURIComponent(state.version)}`); check(pulse.pulse); eq(pulse.answeredCount, 0);
  await stranger.request(`/api/rooms/${code}/control`, { action: "start", status: "lobby", index: -1 }, 403);
  state = await host.request(`/api/rooms/${code}/control`, { action: "start", status: "lobby", index: -1 }); eq(state.status, "question"); eq(state.index, 0);
  const student = await alice.request(`/api/rooms/${code}`); check(!student.isHost); eq(student.correct, null); eq(student.explanation, null); check(!("correct" in student.question), "Correct option is never included during the live question.");
  await alice.request(`/api/rooms/${code}/answer`, { index: 0, option: 0 }, 409);
  await duplicate.request(`/api/rooms/${code}/join`, { name: "Late arrival", avatar: "🦉" }, 409);
  await host.request(`/api/rooms/${code}/control`, { action: "start", status: "lobby", index: -1 }, 409);
  await sleep(Math.max(0, state.startsAt - Date.now() + 30));
  await alice.request(`/api/rooms/${code}/answer`, { index: 0, option: 0 });
  const afterFirst = await alice.request(`/api/rooms/${code}`); check(afterFirst.me.answered); eq(afterFirst.correct, null); eq(afterFirst.me.score, 0, "Current points remain hidden until results."); eq(afterFirst.answeredCount, 1);
  await alice.request(`/api/rooms/${code}/answer`, { index: 0, option: 0 });
  await alice.request(`/api/rooms/${code}/answer`, { index: 0, option: 1 }, 409);
  await sleep(350);
  await bob.request(`/api/rooms/${code}/answer`, { index: 0, option: 0 });
  await carol.request(`/api/rooms/${code}/answer`, { index: 0, option: 1 });
  state = await host.request(`/api/rooms/${code}`); eq(state.status, "results", "Round ends automatically after everyone answers."); eq(state.correct, 0); eq(state.answeredCount, 3);
  check(state.players[0].name === "Alice" && state.players[0].score > state.players[1].score, "The first correct answer ranks first."); eq(state.players.find(p => p.name === "Carol").score, 0); eq(state.players[0].score, 1000); check(state.players[1].score <= 700 && state.players[1].score >= 200);
  const firstScores = new Map(state.players.map(p => [p.id,p.score]));
  for (const p of state.players) eq(p.score, p.roundPoints, "Duplicates never count twice.");
  console.log("✓ Identity, ownership, joining, answer privacy, duplicate protection and first-round ranking.");
  state = await host.request(`/api/rooms/${code}/control`, { action: "next", status: "results", index: 0 }); eq(state.index, 1); eq(state.answeredCount, 0);
  await sleep(Math.max(0, state.startsAt - Date.now() + 30));
  await alice.request(`/api/rooms/${code}/answer`, { index: 1, option: 0 });
  await bob.request(`/api/rooms/${code}/answer`, { index: 1, option: 1 });
  await database.prepare("UPDATE rooms SET ends_at = ? WHERE code = ?").bind(Date.now()-1, code).run();
  state = await host.request(`/api/rooms/${code}`); eq(state.status, "results", "Server closes expired rounds without a host click.");
  const a2 = state.players.find(p => p.name === "Alice"), b2 = state.players.find(p => p.name === "Bob"), c2 = state.players.find(p => p.name === "Carol");
  eq(a2.score, firstScores.get(a2.id)+a2.roundPoints, "Scores accumulate."); eq(b2.score, firstScores.get(b2.id)); eq(c2.score, 0); eq(c2.roundCorrect, null, "Unanswered players receive no points.");
  await carol.request(`/api/rooms/${code}/answer`, { index: 1, option: 0 }, 409);
  state = await host.request(`/api/rooms/${code}/control`, { action: "next", status: "results", index: 1 }); eq(state.index, 2);
  await sleep(Math.max(0, state.startsAt - Date.now() + 30));
  const responses = await Promise.all([alice.request(`/api/rooms/${code}/answer`, { index: 2, option: 0 }), alice.request(`/api/rooms/${code}/answer`, { index: 2, option: 0 }), bob.request(`/api/rooms/${code}/answer`, { index: 2, option: 0 }), carol.request(`/api/rooms/${code}/answer`, { index: 2, option: 0 })]);
  check(responses.every(r => r.accepted));
  state = await host.request(`/api/rooms/${code}`); eq(state.status, "results"); eq(state.answeredCount, 3, "Concurrent duplicate submissions increment counters once.");
  eq(state.players.filter(p => p.roundPoints === 1000).length, 1, "Simultaneous correct answers award the maximum to exactly one player.");
  check(state.players.filter(p => p.roundPoints !== 1000).every(p => p.roundPoints >= 200 && p.roundPoints <= 700), "All other simultaneous correct answers receive the single 30% penalty plus the time loss.");
  state = await host.request(`/api/rooms/${code}/control`, { action: "next", status: "results", index: 2 }); eq(state.status, "finished"); eq(state.players[0].name, "Alice"); check(state.players.every(p => p.position >= 1 && p.position <= 3));
  eq((await alice.request(`/api/rooms/${code}`)).status, "finished", "Reload retains final scores and participant identity.");
  eq((await host.request("/api/dashboard")).rooms.length, 0, "Finished rooms leave the active-room list.");
  const hostHtml = await host.request(`/sala/${code}`); check(hostHtml.includes("QuizEdu"), "Host route renders.");
  const playerHtml = await alice.request(`/participar/${code}`); check(playerHtml.includes("QuizEdu"), "Participant route renders.");
  console.log("✓ Expired timers, unanswered participants, cumulative scores, simultaneous answers and final result.");
  // A difficult question still awards full points to the first correct answer,
  // even after an earlier wrong answer and near the end of the timer.
  const fairQuiz = { ...quiz, id: crypto.randomUUID(), title: "Primeiro acerto e redução por tempo", questions: quiz.questions.slice(0,2).map(q => ({ ...q, seconds:30 })) };
  await host.request("/api/quizzes", fairQuiz);
  const fairRoom = await host.request("/api/rooms", {quizId:fairQuiz.id}, 201);
  for (const [client,name,avatar] of [[alice,"Alice","🦊"],[bob,"Bob","🐼"],[carol,"Carol","🐸"]]) await client.request(`/api/rooms/${fairRoom.code}/join`, {name,avatar}, 201);
  await host.request(`/api/rooms/${fairRoom.code}/control`, {action:"start",status:"lobby",index:-1});
  await database.prepare("UPDATE rooms SET starts_at = ?, ends_at = ? WHERE code = ?").bind(Date.now()-25000,Date.now()+5000,fairRoom.code).run();
  await bob.request(`/api/rooms/${fairRoom.code}/answer`, {index:0,option:1});
  await alice.request(`/api/rooms/${fairRoom.code}/answer`, {index:0,option:0});
  await alice.request(`/api/rooms/${fairRoom.code}/answer`, {index:0,option:0});
  await carol.request(`/api/rooms/${fairRoom.code}/answer`, {index:0,option:0});
  let fair = await host.request(`/api/rooms/${fairRoom.code}`);
  eq(fair.status,"results");eq(fair.answeredCount,3);eq(fair.players.find(p=>p.name==="Alice").roundPoints,1000,"A late first correct answer receives full points; wrong answers do not take its place.");
  eq(fair.players.find(p=>p.name==="Bob").roundPoints,0);
  const lateAnswer = await database.prepare("SELECT points,elapsed_ms FROM answers WHERE room = ? AND question_index = 0 AND correct = 1 AND points <> 1000").bind(fairRoom.code).first();
  eq(lateAnswer.points,200+Math.floor(500*(1-lateAnswer.elapsed_ms/30000)),"Later answers lose 300 fixed points plus the original time penalty.");
  check(lateAnswer.points >= 200 && lateAnswer.points < 300);
  const fairScores = new Map(fair.players.map(p=>[p.id,p.score]));
  await host.request(`/api/rooms/${fairRoom.code}/control`, {action:"next",status:"results",index:0});
  await database.prepare("UPDATE rooms SET starts_at = ?, ends_at = ? WHERE code = ?").bind(Date.now()-3000,Date.now()+27000,fairRoom.code).run();
  await carol.request(`/api/rooms/${fairRoom.code}/answer`, {index:1,option:0});
  await database.prepare("UPDATE rooms SET starts_at = ?, ends_at = ? WHERE code = ?").bind(Date.now()-15000,Date.now()+15000,fairRoom.code).run();
  await alice.request(`/api/rooms/${fairRoom.code}/answer`, {index:1,option:0});
  await database.prepare("UPDATE rooms SET starts_at = ?, ends_at = ? WHERE code = ?").bind(Date.now()-25000,Date.now()+5000,fairRoom.code).run();
  await bob.request(`/api/rooms/${fairRoom.code}/answer`, {index:1,option:0});
  fair = await host.request(`/api/rooms/${fairRoom.code}`);
  eq(fair.players.find(p=>p.name==="Carol").roundPoints,1000,"The first-correct award resets for every question and room.");
  const laterAnswers = await database.prepare("SELECT points,elapsed_ms FROM answers WHERE room = ? AND question_index = 1 AND points <> 1000").bind(fairRoom.code).all();
  eq(laterAnswers.results.length,2);
  for (const a of laterAnswers.results) eq(a.points,200+Math.floor(500*(1-a.elapsed_ms/30000)),"Second and third correct answers use the same fixed penalty.");
  check(fair.players.find(p=>p.name==="Alice").roundPoints > fair.players.find(p=>p.name==="Bob").roundPoints,"Response time still distinguishes later correct answers.");
  for (const p of fair.players) eq(p.score,fairScores.get(p.id)+p.roundPoints,"The new rule accumulates correctly across rounds.");
  fair = await host.request(`/api/rooms/${fairRoom.code}/control`, {action:"next",status:"results",index:1});eq(fair.status,"finished");
  const fairReport = await host.request(`/api/reports/${fairRoom.code}`);
  for (const p of fairReport.players) eq(p.score,fair.players.find(player=>player.id===p.id).score,"Saved reports match the final scoreboard.");
  console.log("✓ Late first correct answer, one fixed 30% penalty, question resets and matching cumulative reports.");
  // Install handoff restores the same anonymous student in a fresh app session.
  const appHome = await anonymous.request("/jogar");check(appHome.includes("Retomando sua sala") && appHome.includes("app-manifest"),"The student app entry and manifest render.");
  const anonymousManifest = await anonymous.request(`/api/app-manifest?sala=${code}`);eq(anonymousManifest.id,"/jogar");eq(anonymousManifest.start_url,`/jogar?sala=${code}`);eq(anonymousManifest.display,"standalone");
  const teacherManifest = await host.request(`/api/app-manifest?sala=${code}`);eq(teacherManifest.start_url,anonymousManifest.start_url,"An educator cannot mint a participant's install access.");
  const ownManifestResponse = await mf.dispatchFetch(origin+`/api/app-manifest?sala=${code}`,{headers:{cookie:[...alice.cookies].map(([k,v])=>`${k}=${v}`).join("; ")}});
  eq(ownManifestResponse.headers.get("cache-control"),"private, no-store");check(ownManifestResponse.headers.get("vary").split(",").some(value=>value.trim().toLowerCase()==="cookie"));check(ownManifestResponse.headers.get("content-type").includes("application/manifest+json"));
  const ownManifest = await ownManifestResponse.json();const installUrl = new URL(ownManifest.start_url,origin);const ticket = new URLSearchParams(installUrl.hash.slice(1)).get("retomar");check(ticket && !installUrl.searchParams.has("retomar"),"Install access stays in the fragment, outside server URL logs.");
  const app = new Client();const beforeInstall = await alice.request(`/api/rooms/${code}`);
  await app.request(`/api/rooms/${code}/resume`,{ticket});check(app.cookies.has(`qe_resume_${code}`));
  const resumed = await app.request(`/api/rooms/${code}`);eq(resumed.me.id,beforeInstall.me.id);eq(resumed.me.name,beforeInstall.me.name);eq(resumed.me.avatar,beforeInstall.me.avatar);eq(resumed.me.score,beforeInstall.me.score);eq(resumed.players.length,beforeInstall.players.length,"Installing never adds another student.");
  await app.request(`/api/rooms/${code}/resume`,{ticket});eq((await app.request(`/api/rooms/${code}`)).me.id,resumed.me.id,"App handoff is idempotent.");
  eq((await alice.request(`/api/rooms/${code}`)).me.id,resumed.me.id,"The original browser keeps the same participant after installation.");
  await app.request(`/api/reports/${code}`,undefined,401);await app.request(`/api/rooms/${code}/control`,{action:"close",status:"finished",index:2},401);
  const invalidApp = new Client();await invalidApp.request(`/api/rooms/${code}/resume`,{ticket:ticket.slice(0,-1)+(ticket.endsWith("0")?"1":"0")},401);
  await invalidApp.request(`/api/rooms/${fairRoom.code}/resume`,{ticket},401);
  const expiredTicket = ticket.split(".");expiredTicket[1]=String(Date.now()-1000);await invalidApp.request(`/api/rooms/${code}/resume`,{ticket:expiredTicket.join(".")},401);
  await invalidApp.request(`/api/rooms/${code}/resume`,{ticket:"x".repeat(200)},400);
  const crossResume = await mf.dispatchFetch(origin+`/api/rooms/${code}/resume`,{method:"POST",headers:{Origin:"https://other.test","content-type":"application/json"},body:JSON.stringify({ticket})});eq(crossResume.status,403);
  await database.prepare("UPDATE rooms SET expires_at = ? WHERE code = ?").bind(Date.now()-1,code).run();await invalidApp.request(`/api/rooms/${code}/resume`,{ticket},409);
  console.log("✓ Install handoff, same participant and score, private manifests, expiry, signature checks and educator isolation.");
  // Room snapshots survive quiz edits/deletion, and capacity is enforced atomically.
  const capacity = await host.request("/api/rooms", { quizId: quiz.id }, 201);
  const crowd = Array.from({ length: 101 }, () => new Client());
  const capacityResults = await Promise.all(crowd.map(async (client,i) => { const response = await mf.dispatchFetch(origin+`/api/rooms/${capacity.code}/join`, { method:"POST", headers:{"content-type":"application/json",Origin:origin}, body:JSON.stringify({name:`Aluno ${i}`,avatar:"🐼"}) }); return response.status; }));
  eq(capacityResults.filter(s => s === 201).length, 100); eq(capacityResults.filter(s => s === 409).length, 1);
  const hundred = await host.request(`/api/rooms/${capacity.code}`); eq(hundred.players.length, 100);
  await host.request(`/api/quizzes/${quiz.id}`, {}, 200, "DELETE");
  const snap = await host.request(`/api/rooms/${capacity.code}/control`, { action:"start",status:"lobby",index:-1 }); eq(snap.question.text, "Pergunta 1", "Room keeps its question snapshot after original quiz deletion.");
  await host.request(`/api/rooms/${capacity.code}/control`, { action:"close",status:"question",index:0 });
  await anonymous.request(`/api/rooms/${capacity.code}/join`, {name:"Depois",avatar:"🐸"},409);
  const crossOrigin = await mf.dispatchFetch(origin+"/api/profile", {method:"POST",headers:{"content-type":"application/json",Origin:"https://other.test"},body:JSON.stringify({name:"Intruso"})}); eq(crossOrigin.status,403);
  await anonymous.request("/api/rooms/000000",undefined,404);
  console.log(`✓ Capacity of 100, immutable room snapshot, closing, CSRF and invalid room. ${checks} checks passed.`);
} finally { await mf.dispose(); }
