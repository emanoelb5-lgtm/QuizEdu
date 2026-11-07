import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import ts from "typescript";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

const temp=await fs.mkdtemp(path.join(os.tmpdir(),"prativerso-cloud-"));let checks=0,mf;
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;},ok=(value,message)=>{assert.ok(value,message);checks++;};
try{
  await fs.writeFile(path.join(temp,"package.json"),'{"type":"module"}');
  for(const name of ["quiz","presentation","presentation-display","presentation-flow","word-cloud"]){const code=ts.transpileModule(await fs.readFile(`lib/${name}.ts`,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from "\.\/(quiz|presentation|presentation-display|word-cloud)"/g,'from "./$1.js"');await fs.writeFile(path.join(temp,`${name}.js`),code);}
  const p=await import(pathToFileURL(path.join(temp,"presentation.js"))),w=await import(pathToFileURL(path.join(temp,"word-cloud.js")));
  eq(w.cloudWord("  CASA  "),{word:"CASA",key:"casa"});eq(w.cloudWord("Aça\u0303o").key,w.cloudWord("Ação").key);eq(w.cloudWord("pôr").key,"pôr");ok(w.cloudWord("por").key!==w.cloudWord("pôr").key);eq(w.cloudWord("d’água").key,"d'água");eq(w.cloudWord("bem-estar").key,"bem-estar");
  for(const value of ["",null,"duas palavras","<script>","=HYPERLINK","😀","a".repeat(41),"-palavra"]){assert.throws(()=>w.cloudWord(value));checks++;}
  const first=p.wordCloudSlide(),second=p.wordCloudSlide();first.wordCloud.prompt="Palavras sobre uma boa aula";second.wordCloud.prompt="Palavras sobre aprender";first.notes="NOTAS PRIVADAS DA NUVEM";
  const q={id:crypto.randomUUID(),text:"Qual é uma vogal?",options:["A","B"],correct:0,seconds:30,explanation:"A é uma vogal.",kind:"multiple"};
  const deck={...p.newDeck(),slides:[p.newSlide("cover"),first,p.questionSlide(q),second,p.newSlide("closing")]};eq(p.validateDeck(deck,true).slides[1].wordCloud,first.wordCloud);eq(p.deckQuestions(deck).length,1);eq(p.duplicateSlide(first).wordCloud,first.wordCloud);ok(p.duplicateSlide(first).id!==first.id);
  assert.throws(()=>p.validateDeck({...deck,slides:[{...first,wordCloud:{prompt:""}}]},true),/tema da nuvem/);checks++;
  let canvas=ts.transpileModule(await fs.readFile("app/ui/slide-canvas.tsx","utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('"@/lib/presentation"','"./presentation.js"').replace('"@/lib/presentation-display"','"./presentation-display.js"').replace('"./poll-view"','"./poll-view.js"');for(const dep of ["react","react/jsx-runtime","lucide-react"])canvas=canvas.replaceAll(JSON.stringify(dep),JSON.stringify(import.meta.resolve(dep)));await fs.writeFile(path.join(temp,"canvas.js"),canvas);
  let pollView=ts.transpileModule(await fs.readFile("app/ui/poll-view.tsx","utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;for(const dep of ["react/jsx-runtime","lucide-react"])pollView=pollView.replaceAll(JSON.stringify(dep),JSON.stringify(import.meta.resolve(dep)));await fs.writeFile(path.join(temp,"poll-view.js"),pollView);
  const {SlideCanvas}=await import(pathToFileURL(path.join(temp,"canvas.js")));
  const html=renderToStaticMarkup(React.createElement(SlideCanvas,{slide:first,cloudWords:[{id:"word-1",word:"Cooperação"}]}));ok(html.includes("Cooperação"));ok(html.includes("100 pontos por palavra nova"));ok(html.includes('role="listitem"'));ok(html.includes(first.wordCloud.prompt));

  const require=createRequire(import.meta.resolve("wrangler")),{Miniflare}=require("miniflare");
  async function walk(dir){const found=[];for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())found.push(...await walk(file));else if(/\.m?js$/.test(file))found.push(file);}return found;}
  const entry=path.resolve("dist/server/index.js"),modules=[entry,...(await walk(path.resolve("dist/server"))).filter(f=>f!==entry)].map(file=>({type:"ESModule",path:file}));
  mf=new Miniflare({modules,modulesRoot:path.resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"prativerso-cloud-test"},r2Buckets:["BUCKET"]});
  const database=await mf.getD1Database("DB");for(const file of (await fs.readdir("drizzle")).filter(f=>f.endsWith(".sql")).sort()){for(const statement of (await fs.readFile(`drizzle/${file}`,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await database.prepare(statement).run();}
  const origin="https://quizedu-emanuel.emanuelb5.chatgpt.site";
  class Client{
    cookies=new Map();
    async raw(route,body,method){return mf.dispatchFetch(origin+route,{method:method||(body===undefined?"GET":"POST"),headers:{cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join("; "),...(body===undefined?{}:{"content-type":"application/json",Origin:origin})},body:body===undefined?undefined:JSON.stringify(body)});}
    async request(route,body,status=200,method){const response=await this.raw(route,body,method);for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(";")[0],i=pair.indexOf("=");this.cookies.set(pair.slice(0,i),pair.slice(i+1));}const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}eq(response.status,status,`${route}: ${text.slice(0,200)}`);return data;}
  }
  const teacher=new Client(),other=new Client(),alice=new Client(),bob=new Client(),late=new Client(),anonymous=new Client();
  await teacher.request("/api/profile",{name:"Professor Emanuel"},201);await other.request("/api/profile",{name:"Outro professor"},201);
  await teacher.request("/api/presentations",{deck,revision:0,writeId:crypto.randomUUID()});
  const room=await teacher.request("/api/rooms",{presentationId:deck.id},201),route=`/api/rooms/${room.code}`;
  await alice.request(`${route}/join`,{name:"Alice",avatar:"🦊"},201);await bob.request(`${route}/join`,{name:"Bob",avatar:"🐼"},201);
  let state=await teacher.request(route);
  const control=async(action,extra={},status=200)=>{const result=await teacher.request(`${route}/control`,{action,status:state.status,index:state.index,slideIndex:state.presentation.index,step:state.presentation.step,...extra},status);if(status===200)state=result;return result;};
  const payload=(word,slideId=first.id,writeId=crypto.randomUUID())=>({word,slideId,writeId});
  await anonymous.request(`${route}/word`,payload("Teste"),401);await alice.request(`${route}/word`,payload("Antes"),409);
  await control("start");await control("next");eq(state.status,"wordcloud");eq(state.index,-1);eq(state.wordCloud.pointsPerWord,100);eq(state.wordCloud.words,[]);eq(state.wordCloud.accepting,true);
  ok(!JSON.stringify(await alice.request(route)).includes(first.notes));await late.request(`${route}/join`,{name:"Clara",avatar:"🐸"},201);
  const aliceOne=payload("Leitura");eq((await alice.request(`${route}/word`,aliceOne,201)).pointsAwarded,100);
  const replay=await alice.request(`${route}/word`,aliceOne);eq(replay.added,false);eq(replay.pointsAwarded,0);
  const duplicate=await bob.request(`${route}/word`,payload("LEITURA"),409);ok(duplicate.error.includes("já está na nuvem"));
  await alice.request(`${route}/word`,payload("Cooperação"),201);await bob.request(`${route}/word`,payload("Imaginação"),201);
  state=await teacher.request(route);eq(state.wordCloud.words.length,3);eq(state.players.find(p=>p.name==="Alice").score,200);eq(state.players.find(p=>p.name==="Bob").score,100);eq(state.wordCloud.myWords,[]);eq((await alice.request(route)).wordCloud.myWords.length,2);
  const before=state.version;
  const race=await Promise.all([alice.raw(`${route}/word`,payload("Criatividade")),bob.raw(`${route}/word`,payload("criatividade"))]);eq(race.map(r=>r.status).sort(),[201,409]);for(const response of race)await response.text();
  state=await teacher.request(route);ok(state.version!==before);eq(state.wordCloud.words.length,4);eq(state.players.reduce((n,p)=>n+p.score,0),400);
  const duplicateRaceId=payload("Curiosidade");const retries=await Promise.all([alice.raw(`${route}/word`,duplicateRaceId),alice.raw(`${route}/word`,duplicateRaceId)]);eq(retries.map(r=>r.status).sort(),[200,201]);for(const response of retries)await response.text();
  state=await teacher.request(route);eq(state.wordCloud.words.length,5);eq(state.players.reduce((n,p)=>n+p.score,0),500);
  const pulse=await alice.request(`${route}?since=${encodeURIComponent(state.version)}`);eq(pulse.pulse,true);
  await alice.request(`${route}/word`,payload("duas palavras"),400);await alice.request(`${route}/word`,payload("<script>"),400);await alice.request(`${route}/word`,payload("Invasão",second.id),409);
  await control("blackout",{blackout:true});eq(state.wordCloud.accepting,false);await bob.request(`${route}/word`,payload("Pausada"),409);await control("blackout",{blackout:false});eq(state.wordCloud.accepting,true);
  await control("next",{},409);await control("end_cloud");await alice.request(`${route}/word`,aliceOne);eq(state.status,"slide");eq(state.wordCloud.accepting,false);await bob.request(`${route}/word`,payload("Encerrada"),409);
  await other.request(`${route}/control`,{action:"resume_cloud",status:state.status,index:state.index,slideIndex:state.presentation.index,step:state.presentation.step},403);
  await control("resume_cloud");eq(state.wordCloud.words.length,5);await bob.request(`${route}/word`,payload("leitura"),409);await control("end_cloud");
  const cloudOnlyReport=await teacher.request(`/api/reports/${room.code}`);eq(cloudOnlyReport.completed,0);eq(cloudOnlyReport.players.reduce((n,p)=>n+p.score,0),500);eq(cloudOnlyReport.wordClouds[0].words.length,5);eq(cloudOnlyReport.players.reduce((n,p)=>n+p.wordCount,0),5);eq(cloudOnlyReport.players.reduce((n,p)=>n+p.wordPoints,0),500);
  await control("next");eq(state.status,"question");await alice.request(`${route}/word`,payload("Durante"),409);
  await database.prepare("UPDATE rooms SET starts_at = ?, ends_at = ? WHERE code = ?").bind(Date.now()-1500,Date.now()+28000,room.code).run();
  await alice.request(`${route}/answer`,{index:0,option:0});await bob.request(`${route}/answer`,{index:0,option:0});await late.request(`${route}/answer`,{index:0,option:1});
  state=await teacher.request(route);eq(state.status,"results");const beforeSecond=new Map(state.players.map(p=>[p.id,p.score]));
  await control("next");eq(state.status,"wordcloud");eq(state.wordCloud.words.length,0);eq(state.wordCloud.slideId,second.id);
  await alice.request(`${route}/word`,payload("Leitura",second.id),201);state=await teacher.request(route);eq(state.players.find(p=>p.name==="Alice").score,beforeSecond.get(state.players.find(p=>p.name==="Alice").id)+100);
  const activeReport=await teacher.request(`/api/reports/${room.code}`);eq(activeReport.completed,1);eq(activeReport.players.map(p=>p.score),state.players.map(p=>p.score));
  await control("end_cloud");await control("next");await control("next");eq(state.status,"finished");
  const report=await teacher.request(`/api/reports/${room.code}`);eq(report.players.map(p=>p.score),state.players.map(p=>p.score));eq(report.wordClouds.map(c=>c.words.length),[5,1]);eq(report.players.reduce((n,p)=>n+p.wordPoints,0),600);
  await other.request(`/api/reports/${room.code}`,undefined,404);await anonymous.request(`/api/reports/${room.code}`,undefined,401);
  const csv=await teacher.request(`/api/reports/${room.code}/csv`);ok(csv.includes("Nuvem de palavras"));ok(csv.includes("Curiosidade"));ok(csv.includes("100"));
  await alice.request(`${route}/word`,payload("Após",second.id),409);
  const single={...p.newDeck(),slides:[p.wordCloudSlide()]};await teacher.request("/api/presentations",{deck:single,revision:0,writeId:crypto.randomUUID()});const justCloud=await teacher.request("/api/rooms",{presentationId:single.id},201);await alice.request(`/api/rooms/${justCloud.code}/join`,{name:"Alice",avatar:"🦊"},201);
  const oneRoute=`/api/rooms/${justCloud.code}`;let one=await teacher.request(oneRoute);const advance=async action=>{one=await teacher.request(`${oneRoute}/control`,{action,status:one.status,index:one.index,slideIndex:one.presentation.index,step:one.presentation.step});};await advance("start");eq(one.status,"wordcloud");await alice.request(`${oneRoute}/word`,{...payload("Aprender",single.slides[0].id),points:100000,player:"forged-player"},201);await advance("end_cloud");await advance("next");eq(one.status,"finished");eq(one.total,0);eq(one.players[0].score,100);eq((await teacher.request(`/api/reports/${justCloud.code}`)).players[0].score,100);
  console.log(`✓ ${checks} word-cloud checks: editable slides, Unicode words, live updates, equal 100-point awards, multiple submissions, atomic duplicates/retries, pause/resume, late joining, mixed quizzes, final ranking, reports and CSV.`);
}finally{if(mf)await mf.dispose();await fs.rm(temp,{recursive:true,force:true});}
