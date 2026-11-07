import { ACCOUNT_COOKIE, SESSION_SECONDS, accountToken, randomToken, readAccountSession, tokenHash } from "./account-session";
import { body, cleanName, db, HttpError, json, sessionCookie, temporaryEducator } from "./server";

const ITERATIONS = 100000;
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, "0")).join("");
const unhex = (value: string) => Uint8Array.from(value.match(/../g) || [], v => parseInt(v, 16));
function emailValue(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Digite um e-mail válido.");
  return email;
}
function passwordValue(value: unknown) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) throw new HttpError(400, "Use uma senha com 12 a 128 caracteres.");
  return value;
}
async function passwordHash(password: string, salt = randomToken()) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(salt), iterations: ITERATIONS }, key, 256);
  return `pbkdf2-sha256$${ITERATIONS}$${salt}$${hex(derived)}`;
}
async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterations, salt, expected] = stored.split("$");
  if (algorithm !== "pbkdf2-sha256" || Number(iterations) !== ITERATIONS || !/^[a-f0-9]{64}$/.test(salt || "") || !/^[a-f0-9]{64}$/.test(expected || "")) return false;
  const actual = (await passwordHash(password, salt)).split("$")[3];
  // Web Crypto verifies HMAC in constant time; no secret string comparison.
  const key = await crypto.subtle.importKey("raw", unhex(expected), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const signature = await crypto.subtle.sign("HMAC", key, unhex(expected));
  return crypto.subtle.verify("HMAC", key, signature, unhex(actual));
}
async function limit(request: Request, action: string, email: string, maximum = 12) {
  const now = Date.now(), window = 15 * 60000;
  const keys = [action + ":ip:" + (request.headers.get("CF-Connecting-IP") || "local"), action + ":email:" + email];
  for (const [index, raw] of keys.entries()) {
    const result = await db().prepare("INSERT INTO auth_limits (key,started_at,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN started_at < ? THEN 1 ELSE attempts + 1 END, started_at = CASE WHEN started_at < ? THEN excluded.started_at ELSE started_at END RETURNING attempts").bind(await tokenHash(raw), now, now - window, now - window).first<{ attempts: number }>();
    if (result!.attempts > (index === 0 ? maximum * 10 : maximum)) throw new HttpError(429, "Muitas tentativas. Aguarde 15 minutos e tente novamente.");
  }
  await db().prepare("DELETE FROM auth_limits WHERE started_at < ?").bind(now - 86400000).run();
}
async function sessionResponse(request: Request, accountId: string, owner: string, recoveryCode?: string, status = 200) {
  const token = randomToken(), now = Date.now();
  await db().batch([
    db().prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(now),
    db().prepare("INSERT INTO auth_sessions (token_hash,account_id,created_at,expires_at) VALUES (?,?,?,?)").bind(await tokenHash(token), accountId, now, now + SESSION_SECONDS * 1000),
  ]);
  const user = await db().prepare("SELECT id,name FROM educators WHERE id = ?").bind(owner).first<{ id: string; name: string }>();
  const response = json({ profile: { ...user, permanent: true }, ...(recoveryCode ? { recoveryCode } : {}) }, status, sessionCookie(request, ACCOUNT_COOKIE, token, SESSION_SECONDS));
  return response;
}
export async function registerAccount(request: Request) {
  const data = await body(request), email = emailValue(data.email), password = passwordValue(data.password), name = cleanName(data.name);
  await limit(request, "register", email, 8);
  if (await db().prepare("SELECT id FROM auth_accounts WHERE email = ?").bind(email).first()) throw new HttpError(409, "Não foi possível criar essa conta. Tente entrar ou recuperar o acesso.");
  const temporary = await temporaryEducator(request), owner = temporary?.id || crypto.randomUUID(), id = crypto.randomUUID(), now = Date.now();
  const recoveryCode = randomToken(), secretHash = await tokenHash(randomToken()), passwordDigest = await passwordHash(password);
  try {
    await db().batch([
      temporary
        ? db().prepare("UPDATE educators SET auth_id = ?,secret_hash = ?,name = ?,expires_at = ? WHERE id = ? AND auth_id IS NULL").bind("prativerso:" + id, secretHash, name, 8640000000000000, owner)
        : db().prepare("INSERT INTO educators (id,secret_hash,name,created_at,expires_at,auth_id) VALUES (?,?,?,?,?,?)").bind(owner, secretHash, name, now, 8640000000000000, "prativerso:" + id),
      db().prepare("INSERT INTO auth_accounts (id,owner,email,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?,?)").bind(id, owner, email, passwordDigest, await tokenHash(recoveryCode), now),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new HttpError(409, "Não foi possível criar essa conta. Tente entrar ou recuperar o acesso.");
    throw error;
  }
  return sessionResponse(request, id, owner, recoveryCode, 201);
}
export async function loginAccount(request: Request) {
  const data = await body(request), email = emailValue(data.email);
  if (typeof data.password !== "string" || data.password.length > 128) throw new HttpError(400, "Confira o e-mail e a senha.");
  await limit(request, "login", email);
  const account = await db().prepare("SELECT id,owner,password_hash FROM auth_accounts WHERE email = ?").bind(email).first<{ id: string; owner: string; password_hash: string }>();
  // Unknown addresses use the same expensive derivation as existing accounts.
  const digest = account?.password_hash || `pbkdf2-sha256$${ITERATIONS}$${"0".repeat(64)}$${"0".repeat(64)}`;
  const valid = await verifyPassword(data.password, digest);
  if (!valid || !account) throw new HttpError(401, "E-mail ou senha incorretos.");
  return sessionResponse(request, account.id, account.owner);
}
export async function logoutAccount(request: Request) {
  const token = accountToken(request.headers);
  if (/^[a-f0-9]{64}$/.test(token)) await db().prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await tokenHash(token)).run();
  const response = json({ signedOut: true }, 200, sessionCookie(request, ACCOUNT_COOKIE, "", 0));
  response.headers.append("Set-Cookie", sessionCookie(request, "qe_host", "", 0));
  return response;
}
export async function recoverAccount(request: Request) {
  const data = await body(request), email = emailValue(data.email), password = passwordValue(data.password);
  await limit(request, "recover", email, 6);
  const code = typeof data.recoveryCode === "string" ? data.recoveryCode.toLowerCase().replace(/[\s-]/g, "") : "";
  if (!/^[a-f0-9]{64}$/.test(code)) throw new HttpError(401, "Confira o e-mail e o código de recuperação.");
  const account = await db().prepare("SELECT id,owner FROM auth_accounts WHERE email = ? AND recovery_hash = ?").bind(email, await tokenHash(code)).first<{ id: string; owner: string }>();
  if (!account) throw new HttpError(401, "Confira o e-mail e o código de recuperação.");
  const newCode = randomToken(), digest = await passwordHash(password);
  const result = await db().batch([
    db().prepare("UPDATE auth_accounts SET password_hash = ?,recovery_hash = ? WHERE id = ? AND recovery_hash = ?").bind(digest, await tokenHash(newCode), account.id, await tokenHash(code)),
    db().prepare("DELETE FROM auth_sessions WHERE account_id = ?").bind(account.id),
    db().prepare("DELETE FROM native_sessions WHERE owner = ?").bind(account.owner),
  ]);
  if (!result[0].meta.changes) throw new HttpError(409, "O código já foi usado. Utilize o código mais recente.");
  return sessionResponse(request, account.id, account.owner, newCode);
}
export async function changePassword(request: Request) {
  const session = await readAccountSession(request.headers);
  if (!session) throw new HttpError(401, "Entre na sua conta para alterar a senha.");
  const data = await body(request), password = passwordValue(data.password);
  await limit(request, "password", session.email, 6);
  const account = await db().prepare("SELECT password_hash FROM auth_accounts WHERE id = ?").bind(session.accountId).first<{ password_hash: string }>();
  if (typeof data.currentPassword !== "string" || data.currentPassword.length > 128 || !account || !await verifyPassword(data.currentPassword, account.password_hash)) throw new HttpError(401, "A senha atual está incorreta.");
  const recoveryCode = randomToken();
  await db().batch([
    db().prepare("UPDATE auth_accounts SET password_hash = ?,recovery_hash = ? WHERE id = ?").bind(await passwordHash(password), await tokenHash(recoveryCode), session.accountId),
    db().prepare("DELETE FROM auth_sessions WHERE account_id = ?").bind(session.accountId),
    db().prepare("DELETE FROM native_sessions WHERE owner = ?").bind(session.owner),
  ]);
  return sessionResponse(request, session.accountId, session.owner, recoveryCode);
}
