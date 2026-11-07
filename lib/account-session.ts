import { env } from "cloudflare:workers";

export const ACCOUNT_COOKIE = "prativerso_session";
export const SESSION_SECONDS = 30 * 86400;
export type AccountSession = { accountId: string; id: string; owner: string; name: string; email: string; expiresAt: number };
export function randomToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join(""); }
export async function tokenHash(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), n => n.toString(16).padStart(2, "0")).join(""); }
export function accountToken(headers: Headers) { return (headers.get("cookie") || "").split(";").map(v => v.trim()).find(v => v.startsWith(ACCOUNT_COOKIE + "="))?.slice(ACCOUNT_COOKIE.length + 1) || ""; }
export async function readAccountSession(headers: Headers): Promise<AccountSession | null> {
  const token = accountToken(headers);
  if (!/^[a-f0-9]{64}$/.test(token) || !env.DB) return null;
  return env.DB.prepare("SELECT a.id accountId,e.auth_id id,e.id owner,e.name,a.email,s.expires_at expiresAt FROM auth_sessions s JOIN auth_accounts a ON a.id = s.account_id JOIN educators e ON e.id = a.owner WHERE s.token_hash = ? AND s.expires_at > ? AND e.expires_at > ?").bind(await tokenHash(token), Date.now(), Date.now()).first<AccountSession>();
}
export function safeReturnPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  try { const url = new URL(value, "https://prativerso.local"); return url.origin === "https://prativerso.local" && !/^\/(entrar|sair|callback)(\/|$)/.test(url.pathname) ? url.pathname + url.search + url.hash : "/"; } catch { return "/"; }
}
