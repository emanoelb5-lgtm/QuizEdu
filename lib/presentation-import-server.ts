import {educator,HttpError,json} from "./server";
import {importPresentation,MAX_IMPORT_BYTES} from "./presentation-import";
export async function readPresentationImport(request:Request){
  const origin=request.headers.get("Origin");if(origin&&origin!==new URL(request.url).origin)throw new HttpError(403,"Esta ação precisa ser feita no Prativerso.");await educator(request);
  if(!request.headers.get("Content-Type")?.startsWith("application/octet-stream"))throw new HttpError(415,"Formato de envio inválido.");
  if(Number(request.headers.get("Content-Length")||0)>MAX_IMPORT_BYTES)throw new HttpError(413,"Use uma apresentação de até 15 MB.");
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,"Escolha um arquivo.");const chunks:Uint8Array[]=[];let total=0;while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_IMPORT_BYTES){await reader.cancel();throw new HttpError(413,"Use uma apresentação de até 15 MB.");}chunks.push(value);}const bytes=new Uint8Array(total);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
  try{const name=decodeURIComponent(request.headers.get("X-Presentation-Name")||"").slice(0,200);return json(await importPresentation(bytes,name));}catch(error){throw new HttpError(400,(error as Error).message);}
}
