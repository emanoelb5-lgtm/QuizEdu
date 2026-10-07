import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
let checks = 0; const ok = (v, message) => { assert.ok(v, message); checks++; }, eq = (a,b,message) => { assert.deepEqual(a,b,message); checks++; };
const compiled = ts.transpileModule(await fs.readFile("lib/live-clock.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const {clockSample, serverTime, bestClock, roomIsOlder} = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const quick = clockSample(100000 + 40, 500, 580), slow = clockSample(100000 + 400, 9000, 9800);
eq(serverTime(quick, 1580), serverTime(slow, 10080), "Different transit times produce the same server time at the same instant.");
eq(serverTime(quick, 3580), 103080);
eq(bestClock(quick, clockSample(101000, 600, 1400)), quick, "A slower sample cannot drag an established countdown backwards.");
ok(bestClock(quick, clockSample(140000, 40000, 40090)) !== quick, "Old clock samples expire.");
ok(roomIsOlder({revision:4,serverNow:200},{revision:5,serverNow:100}), "An older revision remains stale even if its request finishes later.");
ok(!roomIsOlder({revision:6,serverNow:100},{revision:5,serverNow:200}), "A new revision can return to an earlier slide.");
const require = createRequire(import.meta.resolve("wrangler")), {Miniflare} = require("miniflare");
async function walk(dir) { const out=[]; for (const e of await fs.readdir(dir,{withFileTypes:true})) { const p=path.join(dir,e.name); if(e.isDirectory()) out.push(...await walk(p)); else if(/\.m?js$/.test(p)) out.push(p); } return out; }
const entry=path.resolve("dist/server/index.js"), modules=[entry,...(await walk(path.resolve("dist/server"))).filter(p=>p!==entry)].map(p=>({type:"ESModule",path:p}));
const mf = new Miniflare({modules,modulesRoot:path.resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"quizedu-sync-tests"}});
const origin="https://quizedu.test";
class Client {
 cookies=new Map();
 async request(route,data,expected=200) { const r=await mf.dispatchFetch(origin+route,{method:data===undefined?"GET":"POST",headers:{cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join("; "),...(data===undefined?{}:{"Content-Type":"application/json",Origin:origin})},body:data===undefined?undefined:JSON.stringify(data)});for(const c of r.headers.getSetCookie()){const pair=c.split(";")[0],i=pair.indexOf("=");this.cookies.set(pair.slice(0,i),pair.slice(i+1));}const result=await r.json();eq(r.status,expected,JSON.stringify(result));return result; }
}
const readers=[];
async function subscribe(code) {
 const response=await mf.dispatchFetch(`${origin}/api/rooms/${code}/events`);eq(response.status,200);ok(response.headers.get("Content-Type").startsWith("text/event-stream"));ok(response.headers.get("Cache-Control").includes("no-transform"));
 const reader=response.body.getReader();readers.push(reader);let buffer="";const decoder=new TextDecoder();
 return async function next(predicate=()=>true) {
  const deadline=Date.now()+4000;
  while(Date.now()<deadline){const at=buffer.indexOf("\n\n");if(at>=0){const packet=buffer.slice(0,at);buffer=buffer.slice(at+2);const data=packet.split("\n").find(l=>l.startsWith("data:"));if(data){const signal=JSON.parse(data.slice(5));if(predicate(signal))return signal;}continue;}
   const piece=await Promise.race([reader.read(),new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error("No live room signal within 4 seconds")),4000);t.unref();})]);if(piece.done)throw new Error("Stream closed before expected update");buffer+=decoder.decode(piece.value,{stream:true});
  }throw new Error("No matching live update");
 };
}
try {
 const db=await mf.getD1Database("DB");for(const f of (await fs.readdir("drizzle")).filter(f=>f.endsWith(".sql")).sort())for(const s of (await fs.readFile(`drizzle/${f}`,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await db.prepare(s).run();
 const host=new Client(),student=new Client();await host.request("/api/profile",{name:"Emanuel"},201);
 const quiz={id:crypto.randomUUID(),title:"Sincronização da turma",questions:[{id:crypto.randomUUID(),text:"Qual é a alternativa correta?",options:["A","B"],correct:0,seconds:10,explanation:"Teste de tempo."}]};
 await host.request("/api/quizzes",quiz);
 const opened=await host.request("/api/rooms",{quizId:quiz.id},201),code=opened.code;await student.request(`/api/rooms/${code}/join`,{name:"Aluna",avatar:"🦊"},201);
 const browser=await subscribe(code),phone=await subscribe(code);const initial=await browser();await phone();eq(initial.status,"lobby");ok(!("question" in initial)&&!("players" in initial)&&!("correct" in initial),"Signals cannot expose answers or private content.");
 const started=performance.now();const state=await host.request(`/api/rooms/${code}/control`,{action:"start",status:"lobby",index:-1});
 const [a,b]=await Promise.all([browser(s=>s.status==="question"),phone(s=>s.status==="question")]);const latency=performance.now()-started;
 ok(latency<1000,`Local production Worker delivery took ${Math.round(latency)} ms`);eq(a.revision,b.revision);eq(a.version,state.version);ok(a.revision>initial.revision);
 const studentState=await student.request(`/api/rooms/${code}`);eq(studentState.startsAt,state.startsAt);eq(studentState.endsAt,state.endsAt);eq(studentState.correct,null);
 await student.request(`/api/rooms/${code}/answer`,{index:0,option:0,elapsedMs:0,serverNow:state.startsAt},409);
 await new Promise(r=>setTimeout(r,Math.max(0,state.startsAt-Date.now()+20)));
 await student.request(`/api/rooms/${code}/answer`,{index:0,option:0,elapsedMs:-999999});
 const settled=await browser(s=>s.status==="results");ok(settled.revision>state.revision,"The stream settles a completed round without a browser polling request.");
 const results=await student.request(`/api/rooms/${code}`);eq(results.me.roundPoints,1000);ok(results.me.totalMs>=0,"The server keeps authority over elapsed time.");
 console.log(`Live sync: ${checks} checks passed; local start notification ${Math.round(latency)} ms.`);
} finally {await Promise.allSettled(readers.map(r=>r.cancel()));await mf.dispose();}
