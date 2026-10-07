import {PresentationLibrary} from "@/app/ui/presentation-library";
import {chatGPTSignInPath} from "@/app/chatgpt-auth";
export const dynamic="force-dynamic";
export default function Page(){return <PresentationLibrary signInHref={chatGPTSignInPath("/?vincular=1&aulas=1")}/>;}
