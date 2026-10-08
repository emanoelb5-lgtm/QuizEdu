import { PlayerHome } from "@/app/ui/player-home";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await getChatGPTUser();
  return <PlayerHome signedIn={!!user} signInHref={chatGPTSignInPath("/?vincular=1")}/>;
}
