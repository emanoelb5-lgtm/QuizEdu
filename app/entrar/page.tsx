import { redirect } from "next/navigation";
import { getAccountUser } from "../account-auth";
import { safeReturnPath } from "@/lib/account-session";
import { AccountEntry } from "../ui/account-entry";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ return_to?: string; mode?: string }> }) {
  const query = await searchParams, returnTo = safeReturnPath(query.return_to);
  if (await getAccountUser()) redirect(returnTo);
  return <AccountEntry returnTo={returnTo} initialMode={query.mode === "register" || query.mode === "recover" ? query.mode : "login"}/>;
}
