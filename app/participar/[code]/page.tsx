import { PlayerRoom } from "@/app/ui/player-room";
export async function generateMetadata({params}:{params:Promise<{code:string}>}) {const {code}=await params;return {manifest:/^\d{6}$/.test(code)?`/api/app-manifest?sala=${code}`:"/api/app-manifest"};}
export default async function Page({ params }: { params: Promise<{ code: string }> }) { const { code } = await params; return <PlayerRoom code={code} />; }
