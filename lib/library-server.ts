import { env } from "cloudflare:workers";
import { BankQuestion, Draft, LessonReport, Question, Quiz, ReportPlayer } from "./quiz";
import { body, cleanName, db, educator, hash, HttpError, json, platformIdentity, publicProfile, quizFromRow, secret, sessionCookie, temporaryEducator, validateQuiz } from "./server";

export async function linkAccount(request: Request) {
  const data = await body(request); const identity = platformIdentity(request);
  if (!identity) throw new HttpError(401, "Entre com o ChatGPT para vincular sua conta.");
  const temporary = await temporaryEducator(request);
  let permanent = await db().prepare("SELECT * FROM educators WHERE auth_id = ?").bind(identity.id).first<any>();
  const name = cleanName(data.name || permanent?.name || temporary?.name || identity.name);
  if (!permanent && temporary) {
    await db().prepare("UPDATE educators SET auth_id = ?, secret_hash = ?, expires_at = ?, name = ? WHERE id = ? AND auth_id IS NULL").bind(identity.id, await hash(secret()), 8640000000000000, name, temporary.id).run();
  } else if (!permanent) {
    await db().prepare("INSERT OR IGNORE INTO educators (id,secret_hash,name,created_at,expires_at,auth_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),await hash(secret()),name,Date.now(),8640000000000000,identity.id).run();
  }
  permanent = await db().prepare("SELECT * FROM educators WHERE auth_id = ?").bind(identity.id).first<any>();
  if (!permanent) throw new HttpError(503,"Não foi possível vincular agora. Tente novamente.");
  if (temporary && temporary.id !== permanent.id) {
    // A single D1 transaction preserves ownership of all the existing work.
    await db().batch([
      ...["quizzes","rooms","drafts","question_bank","uploads","shares","presentations","native_sessions"].map(table => db().prepare(`UPDATE ${table} SET owner = ? WHERE owner = ?`).bind(permanent.id,temporary.id)),
      db().prepare("UPDATE educators SET expires_at = ?, secret_hash = ? WHERE id = ? AND auth_id IS NULL").bind(Date.now(),await hash(secret()),temporary.id)
    ]);
  }
  return json({profile:publicProfile(permanent)},200,sessionCookie(request,"qe_host","",0));
}
export async function logout(request: Request) { await body(request); return json({signedOut:true},200,sessionCookie(request,"qe_host","",0)); }

export async function saveDraft(request: Request) {
  const user = (await educator(request))!; const data = await body(request); const quiz = validateQuiz(data.quiz,true);
  if (!Number.isInteger(data.revision) || data.revision < 0 || typeof data.writeId !== "string" || !/^[a-f0-9-]{36}$/.test(data.writeId)) throw new HttpError(400,"Rascunho inválido.");
  const previous = await db().prepare("SELECT revision, write_id, updated_at FROM drafts WHERE owner = ? AND id = ?").bind(user.id,quiz.id).first<any>();
  if (previous?.write_id === data.writeId) return json({draft:{id:quiz.id,updatedAt:previous.updated_at,revision:previous.revision,writeId:previous.write_id}});
  if ((previous?.revision || 0) !== data.revision) throw new HttpError(409,"Este rascunho foi alterado em outra tela. Sua cópia continua neste aparelho. Reabra o rascunho antes de continuar.");
  if (!previous) { const count = await db().prepare("SELECT COUNT(*) n FROM drafts WHERE owner = ?").bind(user.id).first<{n:number}>(); if (count!.n >= 100) throw new HttpError(400,"Você tem 100 rascunhos. Salve ou exclua um para continuar."); }
  const now = Date.now();
  const result = await db().prepare("INSERT INTO drafts (owner,id,quiz,updated_at,revision,write_id) VALUES (?,?,?,?,1,?) ON CONFLICT(owner,id) DO UPDATE SET quiz = excluded.quiz, updated_at = excluded.updated_at, revision = drafts.revision + 1, write_id = excluded.write_id WHERE drafts.revision = ?").bind(user.id,quiz.id,JSON.stringify(quiz),now,data.writeId,data.revision).run();
  if (!result.meta.changes) {const raced=await db().prepare("SELECT revision,write_id,updated_at FROM drafts WHERE owner = ? AND id = ?").bind(user.id,quiz.id).first<any>();if(raced?.write_id===data.writeId)return json({draft:{id:quiz.id,revision:raced.revision,writeId:raced.write_id,updatedAt:raced.updated_at}});throw new HttpError(409,"Outra tela salvou esse rascunho. Sua cópia está preservada neste aparelho.");}
  return json({draft:{id:quiz.id,updatedAt:now,revision:data.revision+1,writeId:data.writeId}});
}
export async function deleteDraft(request: Request,id: string) {
  const user = (await educator(request))!; const data = await body(request);
  if (!Number.isInteger(data.revision)) throw new HttpError(400,"Atualize a lista de rascunhos antes de excluir.");
  const result = await db().prepare("DELETE FROM drafts WHERE owner = ? AND id = ? AND revision = ?").bind(user.id,id,data.revision).run();
  if (!result.meta.changes) throw new HttpError(409,"O rascunho mudou ou já foi removido. Atualize a lista.");
  return json({deleted:true});
}

export async function listQuestions(request: Request) {
  const user = (await educator(request))!;
  const rows = await db().prepare("SELECT * FROM question_bank WHERE owner = ? ORDER BY updated_at DESC LIMIT 500").bind(user.id).all<any>();
  return json({questions:rows.results.map((row:any):BankQuestion => ({id:row.id,question:JSON.parse(row.question),subject:row.subject,topic:row.topic,updatedAt:row.updated_at}))});
}
export async function saveQuestion(request: Request) {
  const user = (await educator(request))!; const raw = await body(request);
  const id = typeof raw.id === "string" && /^[a-f0-9-]{36}$/.test(raw.id) ? raw.id : crypto.randomUUID();
  const quiz = validateQuiz({id,title:"Banco de questões",questions:[raw.question],subject:raw.subject,topic:raw.topic});
  const previous = await db().prepare("SELECT owner FROM question_bank WHERE id = ?").bind(id).first<{owner:string}>();
  if (previous && previous.owner !== user.id) throw new HttpError(403,"Essa questão pertence a outro educador.");
  if (!previous) { const count = await db().prepare("SELECT COUNT(*) n FROM question_bank WHERE owner = ?").bind(user.id).first<{n:number}>(); if (count!.n >= 500) throw new HttpError(400,"Seu banco já tem 500 questões. Exclua uma para continuar."); }
  const now = Date.now();
  await db().prepare("INSERT INTO question_bank (id,owner,question,subject,topic,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET question = excluded.question, subject = excluded.subject, topic = excluded.topic, updated_at = excluded.updated_at WHERE question_bank.owner = excluded.owner").bind(id,user.id,JSON.stringify(quiz.questions[0]),quiz.subject,quiz.topic,now).run();
  return json({question:{id,question:quiz.questions[0],subject:quiz.subject,topic:quiz.topic,updatedAt:now}});
}
export async function deleteQuestion(request: Request,id: string) { const user = (await educator(request))!; await body(request); const result = await db().prepare("DELETE FROM question_bank WHERE id = ? AND owner = ?").bind(id,user.id).run(); if (!result.meta.changes) throw new HttpError(404,"Questão não encontrada."); return json({deleted:true}); }

export async function uploadImage(request: Request) {
  const user = (await educator(request))!;
  if (request.headers.get("Origin") !== new URL(request.url).origin) throw new HttpError(403,"Envie a imagem pelo QuizEdu.");
  if (!env.BUCKET) throw new HttpError(503,"O envio de imagens está indisponível agora. Seu texto continua salvo.");
  if (Number(request.headers.get("Content-Length") || 0) > 1048576) throw new HttpError(413,"Use uma imagem de até 1 MB.");
  const reader = request.body?.getReader(); if (!reader) throw new HttpError(400,"Selecione uma imagem.");
  const chunks:Uint8Array[]=[]; let size=0;
  while (true) { const {value,done}=await reader.read(); if (done) break; size += value.byteLength; if (size>1048576) {await reader.cancel(); throw new HttpError(413,"Use uma imagem de até 1 MB.");} chunks.push(value); }
  const bytes = new Uint8Array(size); let offset=0; for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  const type = bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff ? "image/jpeg" : bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4e && bytes[3]===0x47 && bytes[4]===0x0d && bytes[5]===0x0a && bytes[6]===0x1a && bytes[7]===0x0a ? "image/png" : new TextDecoder().decode(bytes.slice(0,4))==="RIFF" && new TextDecoder().decode(bytes.slice(8,12))==="WEBP" ? "image/webp" : null;
  if (!type || size < 20 || request.headers.get("Content-Type")?.split(";")[0] !== type) throw new HttpError(400,"Escolha uma foto JPEG, PNG ou WebP válida.");
  const count = await db().prepare("SELECT COUNT(*) n, COALESCE(SUM(bytes),0) total FROM uploads WHERE owner = ?").bind(user.id).first<{n:number;total:number}>();
  if (count!.n >= 200 || count!.total + size > 50*1024*1024) throw new HttpError(400,"Você atingiu o limite de imagens deste acesso (200 imagens ou 50 MB).");
  const id=crypto.randomUUID(); await env.BUCKET.put(id,bytes,{httpMetadata:{contentType:type}});
  try { await db().prepare("INSERT INTO uploads (id,owner,content_type,bytes,created_at) VALUES (?,?,?,?,?)").bind(id,user.id,type,size,Date.now()).run(); } catch (e) {await env.BUCKET.delete(id); throw e;}
  return json({url:`/api/media/${id}`,bytes:size},201);
}
export async function readImage(id:string) {
  if (!/^[a-f0-9-]{36}$/.test(id) || !env.BUCKET) throw new HttpError(404,"Imagem não encontrada.");
  const object = await env.BUCKET.get(id); if (!object) throw new HttpError(404,"Imagem não encontrada.");
  return new Response(object.body,{headers:{"Content-Type":object.httpMetadata?.contentType || "application/octet-stream","Cache-Control":"public, max-age=31536000, immutable","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'","ETag":object.httpEtag}});
}

export async function shareQuiz(request:Request,id:string) {
  const user = (await educator(request))!; await body(request);
  const row = await db().prepare("SELECT * FROM quizzes WHERE id = ? AND owner = ?").bind(id,user.id).first<any>(); if (!row) throw new HttpError(404,"Salve o quiz antes de compartilhar.");
  const previous = await db().prepare("SELECT token FROM shares WHERE quiz_id = ? AND owner = ?").bind(id,user.id).first<{token:string}>(); const token=previous?.token || secret();
  await db().prepare("INSERT INTO shares (token,quiz_id,owner,quiz,created_at) VALUES (?,?,?,?,?) ON CONFLICT(quiz_id) DO UPDATE SET quiz = excluded.quiz WHERE shares.owner = excluded.owner").bind(token,id,user.id,JSON.stringify(quizFromRow(row)),Date.now()).run();
  return json({token,path:`/compartilhar/${token}`});
}
export async function unshareQuiz(request:Request,id:string) {const user=(await educator(request))!; await body(request); await db().prepare("DELETE FROM shares WHERE quiz_id = ? AND owner = ?").bind(id,user.id).run(); return json({revoked:true});}
export async function sharedQuiz(token:string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404,"Este compartilhamento não está disponível.");
  const row=await db().prepare("SELECT quiz FROM shares WHERE token = ?").bind(token).first<{quiz:string}>(); if (!row) throw new HttpError(404,"Este compartilhamento foi encerrado ou não existe."); return JSON.parse(row.quiz) as Quiz;
}
export async function copySharedQuiz(request:Request,token:string) {
  const user=(await educator(request))!; await body(request); const source=await sharedQuiz(token);
  const count=await db().prepare("SELECT COUNT(*) n FROM quizzes WHERE owner = ?").bind(user.id).first<{n:number}>(); if(count!.n >= (user.auth_id ? 200 : 50)) throw new HttpError(400,"Sua lista de quizzes está cheia. Exporte e exclua um para continuar.");
  const quiz=validateQuiz({...source,id:crypto.randomUUID(),questions:source.questions.map(q=>({...q,id:crypto.randomUUID()}))}); const now=Date.now();
  await db().prepare("INSERT INTO quizzes (id,owner,title,questions,updated_at,mode,untimed,subject,topic) VALUES (?,?,?,?,?,?,?,?,?)").bind(quiz.id,user.id,quiz.title,JSON.stringify(quiz.questions),now,quiz.mode,quiz.untimed?1:0,quiz.subject,quiz.topic).run(); return json({quiz:{...quiz,updatedAt:now}},201);
}

export async function reportData(request:Request,code:string):Promise<LessonReport> {
  const user=(await educator(request))!;
  let room=await db().prepare("SELECT * FROM rooms WHERE code = ? AND owner = ?").bind(code,user.id).first<any>(); if(!room) throw new HttpError(404,"Relatório não encontrado neste acesso.");
  if(room.status==="question" && room.ends_at!==null && room.ends_at<=Date.now()) {await db().prepare("UPDATE rooms SET status = 'results' WHERE code = ? AND status = 'question' AND ends_at <= ?").bind(code,Date.now()).run(); room=await db().prepare("SELECT * FROM rooms WHERE code = ? AND owner = ?").bind(code,user.id).first<any>();}
  const status=room.expires_at<=Date.now()&&room.status!=="finished"?"closed":room.status;
  const allQuestions:Question[]=JSON.parse(room.questions); const completed=Math.min(allQuestions.length,Math.max(0,room.question_index+(["slide","results","finished","closed"].includes(status)?1:0)));
  const [roster,answers]=await db().batch([db().prepare("SELECT id,name,avatar,joined_at FROM players WHERE room = ? ORDER BY joined_at, id").bind(code),db().prepare("SELECT player,question_index,option,correct,points,elapsed_ms FROM answers WHERE room = ? AND question_index < ? ORDER BY question_index").bind(code,completed)]);
  const byPlayer=new Map<string,Map<number,any>>(); for(const a of answers.results as any[]){if(!byPlayer.has(a.player))byPlayer.set(a.player,new Map()); byPlayer.get(a.player)!.set(a.question_index,a);}
  const players:ReportPlayer[]=roster.results.map((p:any)=>{const rows=byPlayer.get(p.id); const list=Array.from({length:completed},(_,i)=>{const a=rows?.get(i); return a?{option:a.option,correct:!!a.correct,points:a.points,elapsedMs:a.elapsed_ms}:null;}); return {id:p.id,name:p.name,avatar:p.avatar,score:list.reduce((s,a)=>s+(a?.points||0),0),correctCount:list.filter(a=>a?.correct).length,answeredCount:list.filter(Boolean).length,position:0,answers:list};});
  // Array.sort is stable: accuracy ties retain join order, without a speed bonus.
  players.sort((a,b)=>b.score-a.score||b.correctCount-a.correctCount||(room.mode==="accuracy"?0:a.answers.reduce((s,v)=>s+(v?.correct?v.elapsedMs:0),0)-b.answers.reduce((s,v)=>s+(v?.correct?v.elapsedMs:0),0))); players.forEach((p,i)=>p.position=i+1);
  const questions=allQuestions.slice(0,completed).map((question,i)=>{const rows=(answers.results as any[]).filter(a=>a.question_index===i); const correct=rows.filter(a=>a.correct).length; return {question,answered:rows.length,correct,accuracy:players.length?Math.round(correct/players.length*100):0,choices:question.options.map((_,o)=>rows.filter(a=>a.option===o).length)};});
  return {code,title:room.title,teacher:room.teacher,createdAt:room.created_at,status,mode:room.mode||"speed",untimed:!!room.untimed,total:allQuestions.length,completed,accuracy:players.length&&completed?Math.round(players.reduce((s,p)=>s+p.correctCount,0)/(players.length*completed)*100):0,players,questions};
}
export async function reportCsv(request:Request,code:string) {
  const report=await reportData(request,code); const rows:unknown[][]=[["Participante","Classificação","Pontos totais","Pergunta","Enunciado","Resposta enviada","Resposta correta","Resultado","Pontos na pergunta","Tempo em segundos"]];
  for(const p of report.players)report.questions.forEach((q,i)=>{const a=p.answers[i]; rows.push([p.name,p.position,p.score,i+1,q.question.text,a?q.question.options[a.option]:"Sem resposta",q.question.options[q.question.correct],a?(a.correct?"Acerto":"Erro"):"Sem resposta",a?.points||0,a?(a.elapsedMs/1000).toFixed(2):""]);});
  const cell=(value:unknown)=>{let text=String(value??""); if(/^[\s]*[=+\-@]/.test(text))text="'"+text; return '"'+text.replaceAll('"','""')+'"';};
  return new Response("\ufeff"+rows.map(r=>r.map(cell).join(";")).join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="QuizEdu-relatorio-${code}.csv"`,"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
}
