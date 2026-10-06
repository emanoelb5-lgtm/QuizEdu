import { RoomHost } from "@/app/ui/room-host";
export default async function Page({ params }: { params: Promise<{ code: string }> }) { const { code } = await params; return <RoomHost code={code} />; }
