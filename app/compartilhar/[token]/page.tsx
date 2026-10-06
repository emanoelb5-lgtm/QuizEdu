import { SharedQuizView } from "@/app/ui/shared-quiz";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
export default async function SharedPage({params}:{params:Promise<{token:string}>}){const {token}=await params;return <SharedQuizView token={token} signInHref={chatGPTSignInPath(`/compartilhar/${token}`)}/>;}
