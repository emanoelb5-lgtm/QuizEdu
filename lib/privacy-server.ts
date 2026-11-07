import {ACCOUNT_COOKIE} from "./account-session";
import {env} from "cloudflare:workers";
import {body,db,educator,hash,HttpError,json,playerFor,sessionCookie} from "./server";

export async function deleteAccount(request:Request){
  const user=(await educator(request))!,data=await body(request);
  if(data.confirmation!=="EXCLUIR")throw new HttpError(400,"Digite EXCLUIR para confirmar a exclusão definitiva.");
  const images=(await db().prepare("SELECT id FROM uploads WHERE owner = ?").bind(user.id).all<{id:string}>()).results;
  if(images.length&&!env.BUCKET)throw new HttpError(503,"A exclusão de imagens está indisponível. Tente novamente; sua conta foi preservada.");
  // Idempotent R2 deletion happens before removing the ownership records so a
  // transient storage failure can be retried without orphaning personal images.
  for(let i=0;i<images.length;i+=100)await env.BUCKET!.delete(images.slice(i,i+100).map(v=>v.id));
  await db().batch([
    db().prepare("DELETE FROM native_sessions WHERE owner = ? OR source_owner = ?").bind(user.id,user.id),
    ...["rooms","shares","drafts","question_bank","quizzes","presentations"].map(t=>db().prepare(`DELETE FROM ${t} WHERE owner = ?`).bind(user.id)),
    // Keep any concurrently added upload metadata until its file can be erased
    // on a retry; the owner FK makes the entire database batch roll back.
    db().prepare("DELETE FROM uploads WHERE owner = ? AND id IN (SELECT value FROM json_each(?))").bind(user.id,JSON.stringify(images.map(v=>v.id))),
    db().prepare("DELETE FROM educators WHERE id = ?").bind(user.id)
  ]);
  const response=json({deleted:true},200,sessionCookie(request,"qe_host","",0));response.headers.append("Set-Cookie",sessionCookie(request,ACCOUNT_COOKIE,"",0));return response;
}
export async function deleteParticipation(request:Request,code:string){
  const data=await body(request),me=await playerFor(request,code,true);
  if(!me)throw new HttpError(401,"Abra a sala no aparelho usado para participar.");
  if(data.confirmation!=="EXCLUIR")throw new HttpError(400,"Digite EXCLUIR para confirmar.");
  await db().prepare("DELETE FROM players WHERE id = ? AND room = ?").bind(me.id,code).run();
  const response=json({deleted:true});response.headers.append("Set-Cookie",sessionCookie(request,`qe_player_${code}`,"",0));response.headers.append("Set-Cookie",sessionCookie(request,`qe_resume_${code}`,"",0));return response;
}
export async function reportClassroom(request:Request,code:string){
  const data=await body(request),me=await playerFor(request,code);
  if(!me)throw new HttpError(401,"Entre na sala antes de avisar o professor.");
  const message=typeof data.message==="string"?data.message.trim():"";
  if(message.length<3||message.length>300)throw new HttpError(400,"Descreva o problema em 3 a 300 caracteres.");
  const id=crypto.randomUUID(),now=Date.now();
  const result=await db().prepare("INSERT INTO classroom_reports (id,room,player,message,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM classroom_reports WHERE room = ? AND player = ? AND created_at > ?) < 5").bind(id,code,me.id,message,now,code,me.id,now-3600000).run();
  if(!result.meta.changes)throw new HttpError(429,"Você já enviou avisos recentemente. Converse com o professor em sala.");
  await db().prepare("UPDATE rooms SET roster_version = roster_version + 1 WHERE code = ?").bind(code).run();
  return json({reported:true},201);
}
export async function moderateClassroom(request:Request,code:string){
  const user=(await educator(request))!,data=await body(request);
  const room=await db().prepare("SELECT owner FROM rooms WHERE code = ?").bind(code).first<{owner:string}>();
  if(room?.owner!==user.id)throw new HttpError(403,"Somente o professor desta sala pode moderar.");
  if(data.action==="hide_word")await db().prepare("UPDATE cloud_words SET hidden = 1 WHERE room = ? AND id = ?").bind(code,String(data.id)).run();
  else if(data.action==="resolve_report"){
    await db().batch([db().prepare("UPDATE classroom_reports SET resolved = 1 WHERE room = ? AND id = ?").bind(code,String(data.id)),db().prepare("UPDATE rooms SET roster_version = roster_version + 1 WHERE code = ?").bind(code)]);
  }else throw new HttpError(400,"Escolha uma ação válida.");
  return json({moderated:true});
}
export async function contactSupport(request:Request){
  const data=await body(request),message=typeof data.message==="string"?data.message.trim():"",email=typeof data.email==="string"?data.email.trim():"";
  if(message.length<10||message.length>2000||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||!["privacidade","exclusao","conteudo","suporte"].includes(data.subject))throw new HttpError(400,"Confira o assunto, o e-mail e sua mensagem (10 a 2.000 caracteres).");
  const now=Date.now(),ip=await hash(request.headers.get("CF-Connecting-IP")||"anonymous"),id=crypto.randomUUID();
  const result=await db().prepare("INSERT INTO support_requests (id,email,subject,message,ip_hash,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM support_requests WHERE ip_hash = ? AND created_at > ?) < 5").bind(id,email,data.subject,message,ip,now,ip,now-86400000).run();
  if(!result.meta.changes)throw new HttpError(429,"Você já enviou mensagens hoje. Tente novamente amanhã.");
  return json({received:true,protocol:id},201);
}
