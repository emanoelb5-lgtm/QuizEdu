import { PlayerHome } from "@/app/ui/player-home";
import { accountSignInPath, getAccountUser } from "@/app/account-auth";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await getAccountUser();
  return <PlayerHome signedIn={!!user} signInHref={accountSignInPath("/?vincular=1")}/>;
}
