import type { RoomState } from "./quiz";

export const ACTIVE_ROOM_KEY = "qe_player_room_v1";
export const LEFT_ROOM_KEY = "qe_player_left_v1";
export type ActiveRoom = { code: string; title: string; expiresAt: number };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function roomCode(value: string, origin: string): string | null {
  const text = value.trim();
  if (/^\d{6}$/.test(text)) return text;
  try {
    const url = new URL(text, origin);
    if (url.origin !== origin || url.username || url.password) return null;
    const match = url.pathname.match(/^\/participar\/(\d{6})\/?$/);
    if (match) return match[1];
    if (url.pathname === "/jogar") {
      const code = url.searchParams.get("sala") || "";
      if (/^\d{6}$/.test(code)) return code;
    }
  } catch {}
  return null;
}

export function readActiveRoom(storage: StorageLike, now = Date.now()): ActiveRoom | null {
  try {
    const value = JSON.parse(storage.getItem(ACTIVE_ROOM_KEY) || "null");
    if (value && typeof value.code === "string" && /^\d{6}$/.test(value.code) && typeof value.title === "string" && value.title.length <= 100 && Number.isFinite(value.expiresAt) && value.expiresAt > now) return value;
    storage.removeItem(ACTIVE_ROOM_KEY);
  } catch {}
  return null;
}
export function saveActiveRoom(storage: StorageLike, room: Pick<RoomState, "code" | "title" | "expiresAt">): boolean {
  try { storage.setItem(ACTIVE_ROOM_KEY, JSON.stringify({code:room.code,title:room.title,expiresAt:room.expiresAt}));storage.removeItem(LEFT_ROOM_KEY);return true; } catch { return false; }
}
export function forgetActiveRoom(storage: StorageLike, code?: string) {
  try { if (!code || readActiveRoom(storage)?.code === code) storage.removeItem(ACTIVE_ROOM_KEY); } catch {}
}
export function leaveActiveRoom(storage: StorageLike, code?: string) {
  try {const current=readActiveRoom(storage);if(code&&current&&current.code!==code)return;forgetActiveRoom(storage);storage.setItem(LEFT_ROOM_KEY,"1");}catch{}
}
export function initialRoomCode(storage: StorageLike, launchCode: string): string | null {
  const current=readActiveRoom(storage);if(current)return current.code;
  try{if(storage.getItem(LEFT_ROOM_KEY)==="1")return null;}catch{}
  return /^\d{6}$/.test(launchCode)?launchCode:null;
}

export function playerManifest(code?: string, ticket?: string) {
  const valid = /^\d{6}$/.test(code || "");
  return {
    id: "/jogar", name: "QuizEdu", short_name: "QuizEdu", lang: "pt-BR",
    description: "Entre na sala do professor e retome seu quiz pelo celular.",
    start_url: valid ? `/jogar?sala=${code}${ticket ? `#retomar=${encodeURIComponent(ticket)}` : ""}` : "/jogar",
    scope: "/", display: "standalone", background_color: "#f5f7fc", theme_color: "#3155ed",
    prefer_related_applications: false,
    icons: [
      {src:"/app-icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
      {src:"/app-icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},
    ],
    shortcuts: [{name:"Entrar em uma sala",short_name:"Nova sala",url:"/jogar?trocar=1"}],
  };
}
