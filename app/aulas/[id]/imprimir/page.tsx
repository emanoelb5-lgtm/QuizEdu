import {PresentationPrint} from "@/app/ui/presentation-library";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PresentationPrint id={id}/>;}
