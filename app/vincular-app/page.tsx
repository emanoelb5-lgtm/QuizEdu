import {chatGPTSignInPath} from "../chatgpt-auth";
import {NativePairing} from "../ui/native-pairing";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}){
 const {id=""}=await searchParams;const valid=/^[a-f0-9-]{36}$/.test(id)?id:"";
 return <NativePairing id={valid} signInHref={chatGPTSignInPath(`/vincular-app?id=${valid}`)}/>;
}
