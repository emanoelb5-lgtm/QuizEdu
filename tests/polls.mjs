import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import ts from "typescript";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import JSZip from "jszip";

const temp=await fs.mkdtemp(path.join(os.tmpdir(),"prativerso-polls-"));let checks=0,mf;
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;},ok=(v,message)=>{assert.ok(v,message);checks++;};
try {
  await fs.writeFile(path.join(temp,"package.json"),'{"type":"module"}');
  for(const name of ["quiz","poll","presentation","presentation-display","presentation-export"]){
    let source=ts.transpileModule(await fs.readFile(`lib/${name}.ts`,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from "\.\/([\w-]+)"/g,'from "./$1.js"').replace('import("pptxgenjs")',`import(${JSON.stringify(import.meta.resolve("pptxgenjs"))})`);
    await fs.writeFile(path.join(temp,`${name}.js`),source);
  }
  const q=await import(pathToFileURL(path.join(temp,"quiz.js"))),p=await import(pathToFileURL(path.join(temp,"presentation.js"))),poll=await import(pathToFileURL(path.join(temp,"poll.js"))),display=await import(pathToFileURL(path.join(temp,"presentation-display.js")));
  const single={...q.newQuestion("poll"),text:"Que tema você quer explorar?",options:["Leitura","Escrita","Debate","Poesia"],explanation:"Vamos conversar sobre as escolhas."};
  const multi={...single,id:crypto.randomUUID(),allowMultiple:true,text:"Quais formatos ajudam você a aprender?",options:["Texto","","Vídeo","Áudio","Jogo","Debate","Mapa","Experimento"],optionImages:["","/examples/solo.jpg","","","","","",""]};
  eq(q.questionIssues(single),[]);eq(q.quizError({title:"Opiniões",questions:[single,multi]}),null);eq(q.newQuestion("poll",{optionCount:8}).options.length,8);
  eq(p.validateDeck({...p.newDeck(),slides:[p.questionSlide(multi)]},true).slides[0].question.allowMultiple,true);
  for(const bad of [{...single,options:[""]},{...single,options:Array(9).fill("Opção")},{...single,options:["",""]},{...single,allowMultiple:"yes"},{...multi,optionImages:["","https://evil.test/photo.jpg","","","","","",""]}])ok(q.questionIssues(bad).some(i=>i.severity==="error"));
  eq(q.questionIssues({...single,options:["",""],optionImages:["/examples/solo.jpg","/examples/erosao.jpg"]}),[]);
  ok(q.questionIssues({...single,options:[" LEITURA ","leitura"]}).some(i=>i.severity==="error"));
  eq(poll.pollChoices([3,0,2],multi),[0,2,3]);eq(poll.pollChoices([1],single),[1]);
  for(const choices of [[],[0,0],[-1],[8],[0.5],["1"],null,[0,1]]){assert.throws(()=>poll.pollChoices(choices,single));checks++;}
  eq(poll.pollSummary(3,[[0,1],[0,2]]),{respondents:2,counts:[2,1,1],percentages:[100,50,50]});eq(poll.pollSummary(2,[]),{respondents:0,counts:[0,0],percentages:[0,0]});
  const ranking=new display.RankingSpotlightSequence();
  eq(ranking.observe({code:"123456",status:"results",index:0,lastRoundIsPoll:true,presentation:{blackout:false,review:false}},100),null);
  eq(ranking.observe({code:"123456",status:"slide",index:0,lastRoundIsPoll:true,presentation:{blackout:false,review:false}},200),null);

  for(const name of ["poll-view","slide-canvas"]){let source=ts.transpileModule(await fs.readFile(`app/ui/${name}.tsx`,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('"./poll-view"','"./poll-view.js"').replace('"@/lib/presentation"','"./presentation.js"').replace('"@/lib/presentation-display"','"./presentation-display.js"');for(const dep of ["react/jsx-runtime","react","lucide-react"])source=source.replaceAll(JSON.stringify(dep),JSON.stringify(import.meta.resolve(dep)));await fs.writeFile(path.join(temp,`${name}.js`),source);}
  const {PollDisplay}=await import(pathToFileURL(path.join(temp,"poll-view.js"))),{SlideCanvas}=await import(pathToFileURL(path.join(temp,"slide-canvas.js")));
  const hidden=renderToStaticMarkup(React.createElement(PollDisplay,{question:multi,results:{allowMultiple:true,revealed:false,respondents:2,myChoices:[]}}));
  ok(hidden.includes("/examples/solo.jpg"));ok(hidden.includes("Experimento"));ok(!hidden.includes("poll-option-stat"));ok(!hidden.includes("Resposta correta"));
  const shown=renderToStaticMarkup(React.createElement(SlideCanvas,{slide:p.questionSlide(multi),pollResults:{...poll.pollSummary(8,[[0,1],[0,2]]),revealed:true,allowMultiple:true,myChoices:[]}}));
  ok(shown.includes("100%"));ok(shown.includes("50%"));ok(shown.includes("soma pode passar de 100%"));ok(shown.includes("poll-on-slide"));
  const {buildPowerPoint}=await import(pathToFileURL(path.join(temp,"presentation-export.js")));
  const oldFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(await fs.readFile("public/examples/solo.jpg"),{headers:{"content-type":"image/jpeg"}});
  let powerPoint;try{powerPoint=await buildPowerPoint({...p.newDeck(),slides:[p.questionSlide(multi)]});}finally{globalThis.fetch=oldFetch;}
  const zip=await JSZip.loadAsync(await powerPoint.write({outputType:"uint8array"})),xml=await zip.file("ppt/slides/slide1.xml").async("string"),notes=await zip.file("ppt/notesSlides/notesSlide1.xml").async("string");
  ok(xml.includes("Experimento"));ok(xml.includes("ENQUETE"));ok(notes.includes("Enquete sem gabarito"));ok(!notes.includes("Resposta correta"));
  for(const match of xml.matchAll(/<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)){ok(+match[1]+ +match[3]<=10*914400+1);ok(+match[2]+ +match[4]<=5.625*914400+1);}

  const require=createRequire(import.meta.resolve("wrangler")),{Miniflare}=require("miniflare");
  async function walk(dir){const found=[];for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())found.push(...await walk(file));else if(/\.m?js$/.test(file))found.push(file);}return found;}
  const entry=path.resolve("dist/server/index.js"),modules=[entry,...(await walk(path.resolve("dist/server"))).filter(f=>f!==entry)].map(file=>({type:"ESModule",path:file}));
  mf=new Miniflare({modules,modulesRoot:path.resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"prativerso-polls-test"},r2Buckets:["BUCKET"]});
  const database=await mf.getD1Database("DB");for(const file of (await fs.readdir("drizzle")).filter(f=>f.endsWith(".sql")).sort())for(const sql of (await fs.readFile(`drizzle/${file}`,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await database.prepare(sql).run();
  const origin="https://quizedu-emanuel.emanuelb5.chatgpt.site";
  class Client{
    cookies=new Map();
    async raw(route,body,method){return mf.dispatchFetch(origin+route,{method:method||(body===undefined?"GET":"POST"),headers:{cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join("; "),...(body===undefined?{}:{"content-type":"application/json",Origin:origin})},body:body===undefined?undefined:JSON.stringify(body)});}
    async request(route,body,status=200,method){const response=await this.raw(route,body,method);for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(";")[0],i=pair.indexOf("=");this.cookies.set(pair.slice(0,i),pair.slice(i+1));}const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}eq(response.status,status,`${route}: ${text.slice(0,200)}`);return data;}
  }
  const host=new Client(),other=new Client(),alice=new Client(),bob=new Client(),clara=new Client(),anonymous=new Client();
  await host.request("/api/profile",{name:"Professora Clara"},201);await other.request("/api/profile",{name:"Outro professor"},201);
  const graded={...q.newQuestion(),text:"Quanto é 2 + 2?",options:["4","5"],correct:0};
  const quiz={...q.newQuiz(),title:"Aula com opiniões",mode:"accuracy",questions:[single,multi,graded]};
  await host.request("/api/quizzes",quiz);
  for(const bad of [{...multi,allowMultiple:"yes"},{...single,options:["",""]},{...single,options:Array(9).fill("Texto")}])await host.request("/api/quizzes",{...quiz,id:crypto.randomUUID(),questions:[bad]},400);
  const savedBank=await host.request("/api/questions",{id:multi.id,question:multi,subject:"Português",topic:"Opiniões"});eq(savedBank.question.question.allowMultiple,true);
  const draft={...quiz,id:crypto.randomUUID(),questions:[q.newQuestion("poll")]};await host.request("/api/drafts",{quiz:draft,revision:0,writeId:crypto.randomUUID()});
  const room=await host.request("/api/rooms",{quizId:quiz.id},201),route=`/api/rooms/${room.code}`;
  await alice.request(`${route}/join`,{name:"Alice",avatar:"🦊"},201);await bob.request(`${route}/join`,{name:"Bob",avatar:"🐼"},201);await clara.request(`${route}/join`,{name:"Clara",avatar:"🐸"},201);
  let state=await host.request(route);
  const control=async(action,status=200)=>{const result=await host.request(`${route}/control`,{action,status:state.status,index:state.index},status);if(status===200)state=result;return result;};
  const ready=()=>database.prepare("UPDATE rooms SET starts_at = ? WHERE code = ?").bind(Date.now()-500,room.code).run();
  const vote=(client,index,choices,status=200)=>client.request(`${route}/vote`,{index,choices},status);
  await vote(anonymous,0,[0],401);await vote(alice,0,[0],409);await control("start");eq(state.endsAt,null);eq(state.correct,null);eq(state.untimed,true);eq(state.gradingTotal,1);
  await vote(alice,0,[0],409);await ready();
  for(const choices of [[],[0,1],[4],[0,0],[0.1],["0"]])await vote(alice,0,choices,400);
  await alice.request(`${route}/answer`,{index:0,option:0},400);
  await vote(other,0,[0],401);
  const version=state.version;
  const race=await Promise.all([alice.raw(`${route}/vote`,{index:0,choices:[0]}),alice.raw(`${route}/vote`,{index:0,choices:[0]})]);eq(race.map(r=>r.status),[200,200]);for(const r of race)await r.text();
  state=await host.request(route);eq(state.poll.respondents,1);ok(state.version!==version);ok(!("counts" in state.poll));ok(!("percentages" in state.poll));eq(state.poll.myChoices,[]);eq((await alice.request(route)).poll.myChoices,[0]);eq((await bob.request(route)).poll.myChoices,[]);eq(state.players.every(p=>p.score===0),true);
  await vote(alice,0,[1],409);await vote(bob,0,[1]);await control("end_round");eq(state.status,"results");eq(state.poll.counts,[1,1,0,0]);eq(state.poll.percentages,[50,50,0,0]);eq(state.poll.respondents,2);eq(state.correct,null);
  await vote(alice,0,[0]);await vote(clara,0,[2],409);
  await control("next");eq(state.index,1);eq(state.endsAt,null);await ready();await vote(alice,0,[0]);
  await vote(alice,1,[1,0]);await vote(alice,1,[0,1]);await vote(bob,1,[0,2]);
  const activeReport=await host.request(`/api/reports/${room.code}`);eq(activeReport.completed,1);eq(activeReport.questions.length,1);eq(activeReport.pollVotes.length,2);
  await control("end_round");eq(state.poll.percentages,[100,50,50,0,0,0,0,0]);eq(state.poll.counts,[2,1,1,0,0,0,0,0]);eq(state.players.every(p=>p.score===0),true);
  await control("next");eq(state.index,2);eq(state.poll,undefined);ok(state.endsAt>state.startsAt);await ready();await alice.request(`${route}/answer`,{index:2,option:0});await bob.request(`${route}/answer`,{index:2,option:1});await clara.request(`${route}/answer`,{index:2,option:0});
  state=await host.request(route);eq(state.status,"results");eq(state.players.map(p=>p.score).sort(),[0,1000,1000]);await control("next");eq(state.status,"finished");
  const report=await host.request(`/api/reports/${room.code}`);eq(report.gradingTotal,1);eq(report.accuracy,67);eq(report.questions[0].poll.percentages,[50,50,0,0]);eq(report.questions[1].poll.percentages,[100,50,50,0,0,0,0,0]);eq(report.pollVotes.length,4);eq(report.players.find(p=>p.name==="Alice").answeredCount,1);eq(report.players.find(p=>p.name==="Alice").answers[0],null);
  const csv=await host.request(`/api/reports/${room.code}/csv`);ok(csv.includes("Enquete 1"));ok(csv.includes("Sem gabarito"));ok(csv.includes("Foto B"));await other.request(`/api/reports/${room.code}`,undefined,404);
  eq((await database.prepare("SELECT COUNT(*) AS n FROM answers WHERE room = ?").bind(room.code).first()).n,3);eq((await database.prepare("SELECT COUNT(*) AS n FROM poll_votes WHERE room = ?").bind(room.code).first()).n,4);

  // Polls follow the same presentation and review controls as scored questions.
  const deck={...p.newDeck(),title:"Enquetes na apresentação",slides:[p.newSlide("cover"),p.questionSlide(single),p.questionSlide(multi),p.newSlide("closing")]};
  await host.request("/api/presentations",{deck,revision:0,writeId:crypto.randomUUID()});
  const pr=await host.request("/api/rooms",{presentationId:deck.id},201),proute=`/api/rooms/${pr.code}`;
  await alice.request(`${proute}/join`,{name:"Alice",avatar:"🦊"},201);await bob.request(`${proute}/join`,{name:"Bob",avatar:"🐼"},201);
  let ps=await host.request(proute);
  const pc=async(action,extra={})=>{ps=await host.request(`${proute}/control`,{action,status:ps.status,index:ps.index,slideIndex:ps.presentation.index,step:ps.presentation.step,...extra});};
  await pc("start");await pc("next");eq(ps.question.kind,"poll");eq(ps.poll.revealed,false);eq(ps.lastRoundIsPoll,true);
  await database.prepare("UPDATE rooms SET starts_at = ? WHERE code = ?").bind(Date.now()-500,pr.code).run();await alice.request(`${proute}/vote`,{index:0,choices:[2]});await bob.request(`${proute}/vote`,{index:0,choices:[2]});ps=await host.request(proute);eq(ps.status,"results");eq(ps.poll.counts,[0,0,2,0]);eq(ps.poll.percentages,[0,0,100,0]);
  await pc("next");await database.prepare("UPDATE rooms SET starts_at = ? WHERE code = ?").bind(Date.now()-500,pr.code).run();await pc("end_round");eq(ps.poll.percentages,Array(8).fill(0));eq(ps.poll.respondents,0);
  await pc("goto",{targetSlide:1});eq(ps.presentation.review,true);eq(ps.poll.counts,[0,0,2,0]);eq(ps.poll.revealed,true);await alice.request(`${proute}/vote`,{index:0,choices:[2]});
  await pc("goto",{targetSlide:3});await pc("next");eq(ps.status,"finished");const prep=await host.request(`/api/reports/${pr.code}`);eq(prep.accuracy,0);eq(prep.gradingTotal,0);eq(prep.questions.length,2);eq(prep.questions[1].poll.respondents,0);
  console.log(`Enquetes: ${checks} verificações concluídas.`);
} finally { if(mf)await mf.dispose();await fs.rm(temp,{recursive:true,force:true}); }
