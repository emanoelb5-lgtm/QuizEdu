import { SharedQuizView } from "@/app/ui/shared-quiz";
import { accountSignInPath } from "@/app/account-auth";
export default async function SharedPage({params}:{params:Promise<{token:string}>}){const {token}=await params;return <SharedQuizView token={token} signInHref={accountSignInPath(`/compartilhar/${token}`)}/>;}
