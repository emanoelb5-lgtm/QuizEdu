import {PresentationWorkspace} from "@/app/ui/presentation-library";
import {chatGPTSignInPath} from "@/app/chatgpt-auth";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PresentationWorkspace id={id} signInHref={chatGPTSignInPath("/?vincular=1&aulas=1")}/>;}
