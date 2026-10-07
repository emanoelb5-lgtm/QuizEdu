"use client";
import { useEffect, useState } from "react";
import { CircleHelp, Loader2, WifiOff } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
export class ApiError extends Error { constructor(message:string,public status:number){super(message);} }
export function Brand({ dark = false, href = "/" }: { dark?: boolean; href?: string }) { return <a href={href} className={`brand ${dark ? "brand-light" : ""}`} aria-label="QuizEdu, início"><span className="brand-mark"><CircleHelp size={24} strokeWidth={2.5} /></span><span>Quiz<span className="brand-edu">Edu</span></span></a>; }
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
export function useClock(serverNow: number, endsAt: number | null) {
  const [offset, setOffset] = useState(0); const [now, setNow] = useState(0);
  useEffect(() => { setOffset(serverNow - Date.now()); setNow(Date.now()); }, [serverNow]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer); }, []);
  return endsAt ? Math.max(0, Math.ceil((endsAt - now - offset) / 1000)) : 0;
}
