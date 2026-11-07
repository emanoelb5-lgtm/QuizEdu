import {PresentationLibrary} from "@/app/ui/presentation-library";
import {accountSignInPath} from "@/app/account-auth";
export const dynamic="force-dynamic";
export default function Page(){return <PresentationLibrary signInHref={accountSignInPath("/?vincular=1&aulas=1")}/>;}
