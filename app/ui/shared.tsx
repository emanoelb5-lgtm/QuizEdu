"use client";
import { useEffect, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { LiveClock, serverTime } from "@/lib/live-clock";
export class ApiError extends Error { constructor(message:string,public status:number){super(message);} }
export function Brand({ dark = false, href = "/" }: { dark?: boolean; href?: string | null }) {
  const content=<><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><path className="brand-orbit" d="M56 19A26 26 0 1 0 44 56" strokeWidth="3" strokeLinecap="round"/><path className="brand-letter" d="M25 49V18H35C43 18 47 22 47 29S43 40 35 40H25" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/><circle className="brand-spark" cx="55" cy="49" r="5"/></svg></span><span className="brand-name">Prativerso</span></>;
  const className=`brand ${dark ? "brand-light" : ""}`;
  return href===null?<span className={className} aria-label="Prativerso">{content}</span>:<a href={href} className={className} aria-label="Prativerso, início">{content}</a>;
}
export function Notifications() { return <Toaster theme="light" position="bottom-center" richColors />; }
export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const controller = new AbortController(); const timeout = setTimeout(()=>controller.abort(),12000);
  let response:Response;
  try { response = await fetch(path, { method: method || (body === undefined ? "GET" : "POST"), credentials: "same-origin", cache: "no-store", signal:controller.signal, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new ApiError("A conexão não respondeu. Seus dados continuam no aparelho. Tente novamente.",0); }
  finally {clearTimeout(timeout);}
  const data = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new ApiError(data.error || "Não foi possível conectar. Tente novamente.",response.status);
  return data as T;
}
export function Loading({ label = "Preparando tudo…" }: { label?: string }) { return <div className="loading"><Loader2 className="spin" /><p>{label}</p></div>; }
export function Offline({ text }: { text: string }) { return <div className="offline" role="status"><WifiOff size={18} /><span>{text}</span></div>; }
export function useClock(serverNow: number, endsAt: number | null, clock?: LiveClock) {
  const [offset, setOffset] = useState(0); const [now, setNow] = useState(0);
  useEffect(() => { setOffset(serverNow - Date.now()); setNow(Date.now()); }, [serverNow]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer); }, []);
  return endsAt ? Math.max(0, Math.ceil((endsAt - (clock ? serverTime(clock, performance.now()) : now + offset)) / 1000)) : 0;
}
