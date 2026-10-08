import {body,cleanName,db,educator,hash,HttpError,json,platformIdentity,publicProfile} from "./server";
import {linkAccount} from "./library-server";

type Device = {id:string;device_name:string;owner:string|null;source_owner:string|null;created_at:number;expires_at:number;approved_at:number|null};
const uuid=(value:unknown):value is string=>typeof value==="string"&&/^[a-f0-9-]{36}$/.test(value);
export async function startNative(request:Request){
 const data=await body(request);if(typeof data.challenge!=="string"||! /^[a-f0-9]{64}$/.test(data.challenge))throw new HttpError(400,"Vínculo inválido.");
 const name=cleanName(data.deviceName||"Prativerso Android",80),now=Date.now();
 const ip=await hash(request.headers.get("CF-Connecting-IP")||"unknown");
 await db().prepare("DELETE FROM native_sessions WHERE expires_at < ?").bind(now).run();
 const count=await db().prepare("SELECT COUNT(*) n FROM native_sessions WHERE ip_hash = ? AND created_at > ?").bind(ip,now-600000).first<{n:number}>();
 if(count!.n>=12)throw new HttpError(429,"Aguarde alguns minutos antes de vincular novamente.");
 const user=await educator(request,false);const id=crypto.randomUUID();
 try{await db().prepare("INSERT INTO native_sessions (id,secret_hash,device_name,source_owner,ip_hash,created_at,expires_at) VALUES (?,?,?,?,?,?,?)").bind(id,data.challenge,name,user&&!user.auth_id?user.id:null,ip,now,now+600000).run();}catch{throw new HttpError(409,"Inicie um novo vínculo no aplicativo.");}
 return json({id,expiresAt:now+600000,path:`/vincular-app?id=${id}`},201);
}
export async function nativeInfo(id:string){
 if(!uuid(id))throw new HttpError(404,"Vínculo não encontrado.");
 const row=await db().prepare("SELECT id,device_name,owner,source_owner,created_at,expires_at,approved_at FROM native_sessions WHERE id = ? AND expires_at > ?").bind(id,Date.now()).first<Device>();
 if(!row)throw new HttpError(410,"Este vínculo expirou. Inicie novamente no aplicativo.");
 return json({id:row.id,deviceName:row.device_name,approved:!!row.approved_at,expiresAt:row.expires_at,hasTemporaryLessons:!!row.source_owner});
}
export async function nativeStatus(request:Request){
 const data=await body(request);if(!uuid(data.id)||typeof data.verifier!=="string"||!/^[a-f0-9]{64}$/.test(data.verifier))throw new HttpError(400,"Vínculo inválido.");
 const row=await db().prepare("SELECT id,device_name,owner,source_owner,created_at,expires_at,approved_at FROM native_sessions WHERE id = ? AND secret_hash = ? AND expires_at > ?").bind(data.id,await hash(data.verifier),Date.now()).first<Device>();
 if(!row)throw new HttpError(410,"Este vínculo não está mais disponível. Inicie novamente.");
 if(!row.approved_at)return json({status:"pending",expiresAt:row.expires_at});
 const user=await db().prepare("SELECT id,name,expires_at,auth_id FROM educators WHERE id = ? AND expires_at > ?").bind(row.owner,Date.now()).first<import("./server").Educator>();
 if(!user)throw new HttpError(401,"Esta conta não está mais disponível.");
 return json({status:"approved",profile:publicProfile(user),expiresAt:row.expires_at});
}
export async function approveNative(request:Request){
 // Approval belongs to the existing browser account, never a second app's bearer.
 if(request.headers.has("Authorization")||request.headers.get("Origin")!==new URL(request.url).origin)throw new HttpError(403,"Autorize o aplicativo pelo Prativerso no navegador.");
 const copy=request.clone() as unknown as Request;const data=await body(request);if(!uuid(data.id))throw new HttpError(400,"Vínculo inválido.");
 if(platformIdentity(request))await linkAccount(copy);
 const user=(await educator(request))!;
 const row=await db().prepare("SELECT id,device_name,owner,source_owner,created_at,expires_at,approved_at FROM native_sessions WHERE id = ? AND expires_at > ?").bind(data.id,Date.now()).first<Device>();
 if(!row)throw new HttpError(410,"Este vínculo expirou. Inicie novamente no aplicativo.");
 if(row.approved_at){if(row.owner!==user.id)throw new HttpError(409,"Este aparelho já foi vinculado.");return json({approved:true});}
 const now=Date.now(),expires=Math.min(user.expires_at,now+30*86400000);
 const writes=[];
 if(data.importTemporary===true&&row.source_owner&&row.source_owner!==user.id){
   const source=row.source_owner;
   for(const table of ["quizzes","rooms","drafts","question_bank","uploads","shares","presentations","native_sessions"])
    writes.push(db().prepare(`UPDATE ${table} SET owner = ? WHERE owner = ? AND EXISTS(SELECT 1 FROM educators WHERE id = ? AND auth_id IS NULL AND expires_at > ?)` ).bind(user.id,source,source,now));
   writes.push(db().prepare("UPDATE educators SET expires_at = ? WHERE id = ? AND auth_id IS NULL").bind(now,source));
 }
 writes.push(db().prepare("UPDATE native_sessions SET owner = ?,approved_at = ?,expires_at = ? WHERE id = ? AND approved_at IS NULL AND expires_at > ?").bind(user.id,now,expires,row.id,now));
 const result=await db().batch(writes);if(!result.at(-1)!.meta.changes)throw new HttpError(409,"O vínculo mudou. Atualize esta página.");
 return json({approved:true,profile:publicProfile(user)});
}
export async function listNative(request:Request){const user=(await educator(request))!;const rows=await db().prepare("SELECT id,device_name deviceName,approved_at approvedAt,expires_at expiresAt FROM native_sessions WHERE owner = ? AND approved_at IS NOT NULL AND expires_at > ? ORDER BY approved_at DESC LIMIT 50").bind(user.id,Date.now()).all();return json({devices:rows.results});}
export async function revokeNative(request:Request,id:string){const user=(await educator(request))!;await body(request);await db().prepare("DELETE FROM native_sessions WHERE id = ? AND owner = ?").bind(id,user.id).run();return json({revoked:true});}
