import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import ts from "typescript";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

const temp=await fs.mkdtemp(path.join(os.tmpdir(),"prativerso-contos-"));
let checks=0,mf;
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const ok=(a,message)=>{assert.ok(a,message);checks++;};
try {
  await fs.writeFile(path.join(temp,"package.json"),'{"type":"module"}');
  for(const name of ["quiz","presentation","presentation-display","example-catalog","contos-example"]){
    const source=await fs.readFile(`lib/${name}.ts`,"utf8");
    const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from "\.\/([\w-]+)"/g,'from "./$1.js"');
    await fs.writeFile(path.join(temp,name+".js"),output);
  }
  const {contosExample}=await import(pathToFileURL(path.join(temp,"contos-example.js")));
  const {CONTOS_EXAMPLE}=await import(pathToFileURL(path.join(temp,"example-catalog.js")));
  const {quizError,questionIssues}=await import(pathToFileURL(path.join(temp,"quiz.js")));
  const {validateDeck,deckQuestions,duplicateDeck}=await import(pathToFileURL(path.join(temp,"presentation.js")));
  const sample=contosExample(),second=contosExample();
  eq(quizError(sample.quiz),null);eq(sample.quiz.questions.length,16);ok(sample.quiz.questions.length>=10);
  eq(sample.quiz.mode,"accuracy");eq(sample.quiz.untimed,true);
  eq(validateDeck(sample.presentation,true).slides.length,19);
  eq(deckQuestions(sample.presentation),sample.quiz.questions,"The two formats share the same complete activity.");
  eq(sample.presentation.mode,"accuracy");eq(sample.presentation.untimed,true);
  const mc=sample.quiz.questions.filter(q=>q.kind==="multiple"),tf=sample.quiz.questions.filter(q=>q.kind==="true_false");
  eq(mc.length,12);eq(tf.length,4);eq([0,1,2,3].map(index=>mc.filter(q=>q.correct===index).length),[3,3,3,3]);
  eq(tf.map(q=>q.correct).sort(),[0,0,1,1]);
  for(const q of sample.quiz.questions){
    eq(questionIssues(q).filter(i=>i.severity==="error"),[]);
    ok(q.explanation.length>60,"Every answer has a usable explanation.");
    ok(q.text.length<=240&&q.options.every(o=>o.length<=100),"Question content stays readable on mobile.");
  }
  ok(sample.quiz.id!==second.quiz.id);ok(sample.presentation.id!==second.presentation.id);
  ok(sample.quiz.questions.every((q,i)=>q.id!==second.quiz.questions[i].id));
  ok(sample.presentation.slides.every((s,i)=>s.id!==second.presentation.slides[i].id));
  const copy=duplicateDeck(sample.presentation);validateDeck(copy,true);
  ok(deckQuestions(copy).every((q,i)=>q.id!==sample.quiz.questions[i].id));
  sample.quiz.questions[0].options[0]="Editado pelo professor";
  eq(second.quiz.questions[0].options[0],contosExample().quiz.questions[0].options[0],"Editing one copy does not mutate the built-in question bank.");

  // Render real entry components, including the public example card and both copy actions.
  const aliases={"@/lib/example-catalog":"./example-catalog.js","./contos-example-card":"./contos-example-card.js","@/lib/presentation":"./presentation.js","@/lib/presentation-display":"./presentation-display.js","./poll-view":"./poll-view.js"};
  for(const name of ["contos-example-card","welcome","slide-canvas","poll-view"]){
    let output=ts.transpileModule(await fs.readFile(`app/ui/${name}.tsx`,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    for(const [from,to] of Object.entries(aliases))output=output.replaceAll(JSON.stringify(from),JSON.stringify(to));
    for(const dep of ["react","react/jsx-runtime","lucide-react"])output=output.replaceAll(JSON.stringify(dep),JSON.stringify(import.meta.resolve(dep)));
    await fs.writeFile(path.join(temp,name+".js"),output);
  }
  const {ContosExampleCard}=await import(pathToFileURL(path.join(temp,"contos-example-card.js")));
  const {Welcome}=await import(pathToFileURL(path.join(temp,"welcome.js")));
  const {SlideCanvas}=await import(pathToFileURL(path.join(temp,"slide-canvas.js")));
  const noOp=()=>{};
  for(const format of ["quiz","presentation"]){
    const html=renderToStaticMarkup(React.createElement(ContosExampleCard,{busy:false,onUse:noOp,format}));
    ok(html.includes(CONTOS_EXAMPLE.title));ok(html.includes("16 perguntas"));ok(html.includes("Sem cronômetro"));
    ok(html.includes(format==="quiz"?"Usar atividade":"Usar apresentação"));
  }
  const welcome=renderToStaticMarkup(React.createElement(Welcome,{code:"",busy:false,error:"",onCode:noOp,onJoin:noOp,onScan:noOp,onQuiz:noOp,onPresentation:noOp,onExample:noOp,onContos:noOp,onRetry:noOp,onTemporary:noOp}));
  ok(welcome.includes("Uma atividade pronta para experimentar"));ok(welcome.includes(CONTOS_EXAMPLE.title));ok(welcome.includes("Usar um quiz de exemplo"),"The original soil example remains accessible.");
  for(const slide of second.presentation.slides){
    const html=renderToStaticMarkup(React.createElement(SlideCanvas,{slide,theme:second.presentation.theme,draft:true,untimed:true}));
    ok(html.includes("slide-frame"));if(slide.kind==="question"){ok(html.includes(slide.question.text));ok(!html.includes(slide.question.explanation),"The answer is absent from a student's question preview.");}
  }

  const require=createRequire(import.meta.resolve("wrangler"));const {Miniflare}=require("miniflare");
  async function walk(dir){const files=[];for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())files.push(...await walk(file));else if(/\.m?js$/.test(file))files.push(file);}return files;}
  const entry=path.resolve("dist/server/index.js");
  mf=new Miniflare({modules:[entry,...(await walk(path.resolve("dist/server"))).filter(f=>f!==entry)].map(file=>({type:"ESModule",path:file})),modulesRoot:path.resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"prativerso-contos-test"},r2Buckets:["BUCKET"]});
  const db=await mf.getD1Database("DB"),origin="https://quizedu.test";
  for(const name of (await fs.readdir("drizzle")).filter(f=>f.endsWith(".sql")).sort())for(const statement of (await fs.readFile(`drizzle/${name}`,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
  class Client {
    cookies=new Map();
    async request(route,body,expected=200){
      const response=await mf.dispatchFetch(origin+route,{method:body===undefined?"GET":"POST",headers:{cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join("; "),...(body===undefined?{}:{"content-type":"application/json",Origin:origin})},body:body===undefined?undefined:JSON.stringify(body)});
      for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(";")[0],at=pair.indexOf("=");this.cookies.set(pair.slice(0,at),pair.slice(at+1));}
      const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
      eq(response.status,expected,`${route}: ${text.slice(0,200)}`);return data;
    }
  }
  const guest=new Client(),host=new Client(),alice=new Client(),bob=new Client();
  const original=await guest.request("/api/examples");eq(original.quiz.questions.length,6);eq(original.presentation.slides.length,14);
  await guest.request("/api/examples?example=missing",undefined,404);
  const endpoint=`/api/examples?example=${CONTOS_EXAMPLE.id}`;
  const content=await guest.request(endpoint),another=await guest.request(endpoint);
  eq(content.example,CONTOS_EXAMPLE);eq(quizError(content.quiz),null);eq(validateDeck(content.presentation,true).slides.length,19);
  ok(content.quiz.id!==another.quiz.id);ok(content.presentation.id!==another.presentation.id);
  const landing=await guest.request("/");ok(landing.includes(CONTOS_EXAMPLE.title));
  await host.request("/api/profile",{name:"Professora de Português"},201);
  await host.request("/api/quizzes",content.quiz);
  eq((await host.request("/api/dashboard")).quizzes[0].questions.length,16);
  const quizRoom=await host.request("/api/rooms",{quizId:content.quiz.id},201),route=`/api/rooms/${quizRoom.code}`;
  await alice.request(`${route}/join`,{name:"Ana",avatar:"🦊"},201);await bob.request(`${route}/join`,{name:"Beto",avatar:"🐼"},201);
  let state=await host.request(`${route}/control`,{action:"start",status:"lobby",index:-1});
  for(const [index,q] of content.quiz.questions.entries()){
    eq(state.status,"question");eq(state.index,index);eq(state.mode,"accuracy");eq(state.untimed,true);eq(state.endsAt,null);
    const mobile=await alice.request(route);eq(mobile.correct,null);eq(mobile.explanation,null);ok(!("correct" in mobile.question));
    // Simulate a very slow response without a long test sleep. A wrong answer
    // and both MC/true-false formats still use the original gabarito.
    await db.prepare("UPDATE rooms SET starts_at = ? WHERE code = ?").bind(Date.now()-180000,quizRoom.code).run();
    await alice.request(`${route}/answer`,{index,option:q.correct});
    await bob.request(`${route}/answer`,{index,option:index===6?1-q.correct:q.correct});
    state=await host.request(route);eq(state.status,"results");eq(state.correct,q.correct);eq(state.explanation,q.explanation);
    eq(state.players.find(p=>p.name==="Ana").roundPoints,1000);eq(state.players.find(p=>p.name==="Beto").roundPoints,index===6?0:1000,"Correct responses have equal points regardless of order or delay.");
    state=await host.request(`${route}/control`,{action:"next",status:"results",index});
  }
  eq(state.status,"finished");const report=await host.request(`/api/reports/${quizRoom.code}`);eq(report.completed,16);eq(report.total,16);eq(report.questions.map(row=>row.question.correct),content.quiz.questions.map(q=>q.correct));
  eq(report.players.find(p=>p.name==="Ana").score,16000);eq(report.players.find(p=>p.name==="Beto").score,15000);

  // Save an editable presentation copy and run its entire sequence, including
  // manual discussion pauses, private teaching notes and the closing slide.
  await host.request("/api/presentations",{deck:content.presentation,revision:0,writeId:crypto.randomUUID()});
  eq((await host.request("/api/presentations")).presentations[0].questionCount,16);
  const saved=(await host.request(`/api/presentations/${content.presentation.id}`)).presentation;
  saved.deck.slides[0].notes+="\nObservação da professora.";
  await host.request("/api/presentations",{deck:saved.deck,revision:saved.revision,writeId:crypto.randomUUID()});
  const deckRoom=await host.request("/api/rooms",{presentationId:saved.deck.id},201),deckRoute=`/api/rooms/${deckRoom.code}`;
  await alice.request(`${deckRoute}/join`,{name:"Ana",avatar:"🦊"},201);
  state=await host.request(deckRoute);
  const control=async(action)=>{state=await host.request(`${deckRoute}/control`,{action,status:state.status,index:state.index,slideIndex:state.presentation.index,step:state.presentation.step});return state;};
  await control("start");eq(state.presentation.index,0);
  ok(state.presentation.slide.notes.includes("Observação da professora."));ok(!JSON.stringify(await alice.request(deckRoute)).includes("Observação da professora."));
  await control("next");eq(state.presentation.index,1);
  await control("next");
  for(let index=0;index<16;index++){
    eq(state.status,"question");eq(state.index,index);eq(state.endsAt,null);
    await control("end_round");eq(state.status,"results");eq(state.explanation,content.quiz.questions[index].explanation);
    await control("next");
  }
  eq(state.status,"slide");eq(state.presentation.index,18);eq(state.presentation.slide.title,"Que ideia você leva desta aula?");
  await control("next");eq(state.status,"finished");
  console.log(`✓ Fifth-day example: 16 validated questions, independent copies, public discovery, fair untimed scoring, all-round feedback, editable slides and private teaching notes. ${checks} checks passed.`);
} finally {
  if(mf)await mf.dispose();await fs.rm(temp,{recursive:true,force:true});
}
