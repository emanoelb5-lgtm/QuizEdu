import { Dashboard } from "@/app/ui/dashboard";
import { chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default function Home() { return <Dashboard signInHref={chatGPTSignInPath("/?vincular=1")} signOutHref={chatGPTSignOutPath("/")} signInTargets={{quiz:chatGPTSignInPath("/?vincular=1&criar=quiz"),presentation:chatGPTSignInPath("/?vincular=1&criar=presentation"),example:chatGPTSignInPath("/?vincular=1&criar=example")}} />; }
