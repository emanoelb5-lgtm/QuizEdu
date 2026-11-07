import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.resolve("wrangler")), { Miniflare } = require("miniflare");
const origin = "https://prativerso.b5solucoes.online";
const mf = new Miniflare({ modules: [{ type: "ESModule", path: path.resolve("dist/pages/_worker.js") }], compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], d1Databases: ["DB"], r2Buckets: ["BUCKET"] });
let checks = 0, nextIp = 1;
const eq = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
class Client {
  cookies = new Map(); ip = `192.0.2.${nextIp++}`;
  async request(route, data, status = 200, extra = {}) {
    const response = await mf.dispatchFetch(origin + route, { method: data === undefined ? "GET" : "POST", headers: { "CF-Connecting-IP": this.ip, cookie: [...this.cookies].map(([k,v]) => `${k}=${v}`).join("; "), ...(data === undefined ? {} : { "Content-Type": "application/json", Origin: origin }), ...extra }, body: data === undefined ? undefined : JSON.stringify(data) });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0], at = pair.indexOf("="); this.cookies.set(pair.slice(0,at), pair.slice(at+1)); }
    const raw = await response.text(); let value; try { value = JSON.parse(raw); } catch { value = raw; }
    eq(response.status, status, `${route}: ${typeof value === "object" ? value.error || "unexpected status" : raw.slice(0,100)}`);
    return { value, headers: response.headers };
  }
}
try {
  const database = await mf.getD1Database("DB");
  for (const file of (await fs.readdir("drizzle")).filter(n => n.endsWith(".sql")).sort()) for (const sql of (await fs.readFile("drizzle/" + file, "utf8")).split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await database.prepare(sql).run();
  const teacher = new Client(), browser = new Client(), stranger = new Client(), anonymous = new Client();
  const loginPage = (await anonymous.request("/entrar")).value; ok(loginPage.includes("Bom ter você")); ok(!loginPage.includes("Continuar com ChatGPT"));
  const unsafe = await anonymous.request("/entrar?return_to=https%3A%2F%2Fevil.test"); ok(unsafe.value.includes("Entrar"));
  await anonymous.request("/api/auth/register", { name: "Teste", email: "invalid", password: "abcdefghijklmn" }, 400);
  await anonymous.request("/api/auth/register", { name: "Teste", email: "teacher@example.test", password: "short" }, 400);
  await anonymous.request("/api/auth/register", { name: "Teste", email: "teacher@example.test", password: "abcdefghijklmn" }, 403, { Origin: "https://evil.test" });
  const temporary = (await teacher.request("/api/profile", { name: "Professor Emanuel" }, 201)).value.profile;
  const quiz = { id: crypto.randomUUID(), title: "Atividade preservada", questions: [{ id: crypto.randomUUID(), text: "Qual prática protege o solo?", options: ["Cobertura", "Solo exposto"], correct: 0, seconds: 30, explanation: "A cobertura protege o solo." }] };
  await teacher.request("/api/quizzes", quiz);
  const registered = await teacher.request("/api/auth/register", { name: "Professor Emanuel", email: "TEACHER@example.test", password: "Minha senha muito segura!" }, 201);
  eq(registered.value.profile.id, temporary.id); ok(registered.value.profile.permanent); ok(/^[a-f0-9]{64}$/.test(registered.value.recoveryCode));
  const recoveryCode = registered.value.recoveryCode, firstToken = teacher.cookies.get("prativerso_session");
  ok(registered.headers.get("Set-Cookie").includes("HttpOnly")); ok(registered.headers.get("Set-Cookie").includes("Secure")); ok(!registered.headers.get("Set-Cookie").includes("Domain="));
  const stored = await database.prepare("SELECT password_hash,recovery_hash FROM auth_accounts").first();
  ok(!stored.password_hash.includes("Minha senha")); ok(!stored.recovery_hash.includes(recoveryCode)); eq(stored.password_hash.split("$")[0], "pbkdf2-sha256");
  const storedSession = await database.prepare("SELECT token_hash FROM auth_sessions").first(); ok(storedSession.token_hash !== firstToken);
  eq((await teacher.request("/api/dashboard")).value.quizzes[0].id, quiz.id);
  await browser.request("/api/auth/login", { email: "teacher@example.test", password: "wrong-password" }, 401);
  await browser.request("/api/auth/login", { email: "unknown@example.test", password: "wrong-password" }, 401);
  await browser.request("/api/auth/login", { email: "teacher@example.test", password: "Minha senha muito segura!" });
  ok(browser.cookies.get("prativerso_session") !== firstToken); eq((await browser.request("/api/dashboard")).value.profile.id, temporary.id);
  await stranger.request("/api/auth/register", { name: "Outra pessoa", email: "other@example.test", password: "Outra senha muito segura!" }, 201);
  eq((await stranger.request("/api/dashboard")).value.quizzes, []); await stranger.request("/api/quizzes", quiz, 403);
  const forged = await anonymous.request("/api/dashboard", undefined, 200, { "oai-authenticated-user-id": temporary.id, "oai-authenticated-user-email": "teacher@example.test" }); eq(forged.value.profile, null);
  await browser.request("/api/logout", {}); eq((await browser.request("/api/dashboard")).value.profile, null); ok((await teacher.request("/api/dashboard")).value.profile);
  const nativeSecret = "a".repeat(64), nativeHash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nativeSecret))).toString("hex");
  const native = (await anonymous.request("/api/native/start", { challenge: nativeHash, deviceName: "Android de teste" }, 201)).value;
  await teacher.request("/api/native/approve", { id: native.id }); eq((await anonymous.request("/api/native/status", { id: native.id, verifier: nativeSecret })).value.status, "approved");
  await anonymous.request("/api/auth/recover", { email: "teacher@example.test", password: "Senha nova muito segura!", recoveryCode: "f".repeat(64) }, 401);
  const recovered = (await browser.request("/api/auth/recover", { email: "teacher@example.test", password: "Senha nova muito segura!", recoveryCode })).value;
  ok(recovered.recoveryCode !== recoveryCode); eq((await teacher.request("/api/dashboard")).value.profile, null); await anonymous.request("/api/native/status", { id: native.id, verifier: nativeSecret }, 410);
  await teacher.request("/api/auth/login", { email: "teacher@example.test", password: "Minha senha muito segura!" }, 401);
  await teacher.request("/api/auth/recover", { email: "teacher@example.test", password: "Outra senha qualquer!", recoveryCode }, 401);
  await teacher.request("/api/auth/login", { email: "teacher@example.test", password: "Senha nova muito segura!" });
  await teacher.request("/api/auth/password", { currentPassword: "errada", password: "Senha final muito segura!" }, 401);
  const changed = (await teacher.request("/api/auth/password", { currentPassword: "Senha nova muito segura!", password: "Senha final muito segura!" })).value;
  ok(changed.recoveryCode !== recovered.recoveryCode); eq((await browser.request("/api/dashboard")).value.profile, null);
  await teacher.request("/api/account/delete", { confirmation: "EXCLUIR" }); eq((await teacher.request("/api/dashboard")).value.profile, null);
  eq((await database.prepare("SELECT COUNT(*) n FROM auth_accounts WHERE email=?").bind("teacher@example.test").first()).n, 0);
  eq((await database.prepare("SELECT COUNT(*) n FROM auth_sessions").first()).n, 1, "Only the other account keeps a session.");
  const limited = new Client(); for (let i = 0; i < 12; i++) await limited.request("/api/auth/login", { email: "limited@example.test", password: "invalid-password" }, 401);
  await limited.request("/api/auth/login", { email: "limited@example.test", password: "invalid-password" }, 429);
  console.log(`✓ ${checks} account checks passed against the packaged Cloudflare Pages Worker: registration, login, recovery, rotation, revocation, Android linking, isolation, deletion and rate limits.`);
} finally { await mf.dispose(); }
