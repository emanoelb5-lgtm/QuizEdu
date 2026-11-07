import { headers } from "next/headers";
import { readAccountSession, safeReturnPath } from "@/lib/account-session";
export async function getAccountUser() { return readAccountSession(new Headers(await headers())); }
export function accountSignInPath(returnTo = "/") { return `/entrar?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`; }
export function accountSignOutPath(_returnTo = "/") { return "/"; }
