import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import ts from "typescript";
import JSZip from "jszip";
const temp=await fs.mkdtemp(path.join(os.tmpdir(),"prativerso-lessons-"));let mf,checks=0;
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;},ok=(v,message)=>{assert.ok(v,message);checks++;};
try{
  await fs.writeFile(path.join(temp,"package.json"),'{"type":"module"}');await fs.mkdir(path.join(temp,"ready-lessons"));await fs.copyFile("lib/ready-lessons/artigo-opiniao.json",path.join(temp,"ready-lessons/artigo-opiniao.json"));
  for(const name of ["quiz","presentation","presentation-export","lesson-catalog","ready-lessons","article-opinion","contos-example","example-catalog"]){
    let source=ts.transpileModule(await fs.readFile(`lib/${name}.ts`,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from "\.\/([\w-]+)"/g,'from "./$1.js"').replace('import("pptxgenjs")',`import(${JSON.stringify(import.meta.resolve("pptxgenjs"))})`).replace('"./ready-lessons/artigo-opiniao.json";','"./ready-lessons/artigo-opiniao.json" with {type:"json"};');
    await fs.writeFile(path.join(temp,name+".js"),source);
  }
  const {READY_LESSONS,filterReadyLessons}=await import(pathToFileURL(path.join(temp,"lesson-catalog.js")));
  const {readyLesson}=await import(pathToFileURL(path.join(temp,"ready-lessons.js")));
  const {validateDeck,deckQuestions,richTextPlain}=await import(pathToFileURL(path.join(temp,"presentation.js")));
  const {mediaPath}=await import(pathToFileURL(path.join(temp,"quiz.js")));
  eq(filterReadyLessons().length,3);eq(filterReadyLessons({subject:"portugues"}).length,2);eq(filterReadyLessons({subject:"portugues",grade:"9"}).length,1);
  eq(filterReadyLessons({query:"OPINIAO"})[0].title,"Artigo de opinião");eq(filterReadyLessons({query:"celular 9"}).length,1);eq(filterReadyLessons({query:"variacao linguistica"})[0].id,"contos-7-ano-dia-5");eq(filterReadyLessons({subject:"agroecologia",query:"erosao"}).length,1);
  eq(filterReadyLessons({subject:"missing"}),[]);eq(filterReadyLessons({subject:"portugues",grade:"livre"}),[]);eq(readyLesson("__proto__"),undefined);
  for(const lesson of READY_LESSONS){
    const first=readyLesson(lesson.id).presentation,second=readyLesson(lesson.id).presentation;
    eq(validateDeck(first,true).slides.length,lesson.slideCount);eq(deckQuestions(first).filter(q=>q.kind!=="poll").length,lesson.questionCount);eq(deckQuestions(first).filter(q=>q.kind==="poll").length,lesson.pollCount||0);eq(first.slides.filter(s=>s.kind==="wordcloud").length,lesson.cloudCount);
    ok(first.id!==second.id&&first.slides.every((s,i)=>s.id!==second.slides[i].id));ok(deckQuestions(first).every((q,i)=>q.id!==deckQuestions(second)[i].id));
  }
  const id="artigo-opiniao-9-ano-aula-1",content=readyLesson(id),deck=content.presentation;
  eq(deck.mode,"accuracy");eq(deck.untimed,true);eq(deck.slides.length,36);eq(deckQuestions(deck).filter(q=>q.kind!=="poll").map(q=>q.correct),[1,0,2,2,2,1,1]);
  ok(deckQuestions(deck).filter(q=>q.kind!=="poll").every(q=>q.kind==="multiple"&&q.explanation.length>60));
  const polls=deckQuestions(deck).filter(q=>q.kind==="poll");eq(polls.length,4);eq(deck.slides.slice(2,5).map(s=>s.question.options),[["Nescau","Toddy"],["Com açúcar","Sem açúcar"],["Ler o livro","Assistir ao filme"]]);eq(deck.slides.at(-1).question.options,["Bom","Ótimo","OK","Ruim"]);ok(polls.every(q=>q.correct===-1&&q.allowMultiple===false));eq(content.supportText.paragraphs.length,6);
  const visible=deck.slides.flatMap(s=>s.elements.filter(e=>e.type==="text").map(e=>richTextPlain(e.doc))).join("\n");
  for(const paragraph of content.supportText.paragraphs)ok(visible.includes(paragraph),"The reference reading is part of the slides, not an unavailable handout.");
  ok(!visible.includes("Pergunta aberta final para o Prativerso."));ok(deck.slides.find(s=>s.title==="Saída da aula").notes.includes("Fechamento oral"));
  for(const phrase of ["O que caracteriza um artigo de opinião?","Autoria, linguagem e organização","Oferece razões, exemplos, dados ou fontes.","Retoma a ideia defendida e fecha a reflexão."])ok(visible.includes(phrase));
  const reading=deck.slides.filter(s=>s.title.startsWith("Texto de apoio"));eq(reading.length,6);ok(reading.every(s=>s.elements.find(e=>richTextPlain(e.doc)===content.supportText.paragraphs[reading.indexOf(s)]).fontSize>=36));
  const images=deck.slides.flatMap(s=>s.elements.filter(e=>e.type==="image"));eq(new Set(images.map(e=>e.src)).size,4);
  for(const image of images){ok(mediaPath(image.src));ok(image.alt.length>20);const bytes=await fs.readFile("public"+image.src);ok(bytes.length>1000);eq(bytes.subarray(0,3).toString("hex"),"ffd8ff");}
  for(const src of polls.slice(0,3).flatMap(q=>q.optionImages)){ok(mediaPath(src));const bytes=await fs.readFile("public"+src);eq(bytes.subarray(0,3).toString("hex"),"ffd8ff");ok(bytes.length>1000);}
  for(const src of ["/lessons/artigo-opiniao/ilustracao-5.jpg","/lessons/../../secret.jpg","/lessons/artigo-opiniao/ilustracao-1.jpg?x=1","https://evil.test/lessons/artigo-opiniao/ilustracao-1.jpg"])eq(mediaPath(src),false);
  const altered=readyLesson(id);altered.presentation.slides[0].elements=[];eq(readyLesson(id).presentation.slides[0].elements.length,deck.slides[0].elements.length,"Using and editing a copy cannot mutate the catalog master.");

  // The existing PowerPoint export embeds the classroom photographs as JPEGs,
  // rather than depending on website paths or unsupported WebP media in Office.
  const {buildPowerPoint}=await import(pathToFileURL(path.join(temp,"presentation-export.js")));
  const previousFetch=globalThis.fetch;
  try{
    globalThis.fetch=async(src,init)=>typeof src==="string"&&src.startsWith("/lessons/artigo-opiniao/")?new Response(await fs.readFile("public"+src),{headers:{"content-type":"image/jpeg"}}):previousFetch(src,init);
    const pptx=await buildPowerPoint(deck),zip=await JSZip.loadAsync(await pptx.write({outputType:"nodebuffer",compression:true}));
    eq(Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).length,36);
    ok(Object.keys(zip.files).filter(name=>/^ppt\/media\/.*\.(jpg|jpeg)$/.test(name)).length>=4);
    ok(!Object.keys(zip.files).some(name=>name.endsWith(".webp")));
  }finally{globalThis.fetch=previousFetch;}

  const require=createRequire(import.meta.resolve("wrangler")),{Miniflare}=require("miniflare");
  async function walk(dir){const files=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())files.push(...await walk(file));else if(/\.m?js$/.test(file))files.push(file);}return files;}
  const entry=path.resolve("dist/server/index.js");mf=new Miniflare({modules:[entry,...(await walk(path.resolve("dist/server"))).filter(f=>f!==entry)].map(file=>({type:"ESModule",path:file})),modulesRoot:path.resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"prativerso-catalog-test"},r2Buckets:["BUCKET"]});
  const db=await mf.getD1Database("DB");for(const file of (await fs.readdir("drizzle")).filter(f=>f.endsWith(".sql")).sort())for(const sql of (await fs.readFile(`drizzle/${file}`,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  const origin="https://quizedu-emanuel.emanuelb5.chatgpt.site";
  class Client{cookies=new Map();identity=null;async request(route,body,status=200){
    const response=await mf.dispatchFetch(origin+route,{method:body===undefined?"GET":"POST",headers:{cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join("; "),...(body===undefined?{}:{"content-type":"application/json",Origin:origin}),...(this.identity?{"oai-authenticated-user-id":this.identity.id,"oai-authenticated-user-email":this.identity.email,"oai-authenticated-user-full-name":encodeURIComponent(this.identity.name),"oai-authenticated-user-full-name-encoding":"percent-encoded-utf-8"}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(";")[0],at=pair.indexOf("=");this.cookies.set(pair.slice(0,at),pair.slice(at+1));}const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}eq(response.status,status,`${route}: ${text.slice(0,160)}`);return data;
  }}
  const guest=new Client(),host=new Client(),other=new Client(),alice=new Client(),bob=new Client();
  eq((await guest.request("/api/lessons")).lessons.length,3);eq((await guest.request("/api/lessons?subject=portugues&grade=9&q=opini%C3%A3o")).lessons.length,1);
  eq((await guest.request("/api/lessons?subject=missing")).lessons,[]);await guest.request("/api/lessons/missing",undefined,404);
  const first=await guest.request(`/api/lessons/${id}`),second=await guest.request(`/api/lessons/${id}`);eq(first.lesson.id,id);eq(first.supportText.paragraphs.length,6);ok(first.presentation.id!==second.presentation.id);eq(validateDeck(first.presentation,true).slides.length,36);
  for(const route of ["/aulas-prontas","/aulas-prontas?disciplina=portugues"]){const html=await guest.request(route);ok(html.includes("Aulas prontas")&&html.includes("Artigo de opinião"));ok(html.includes('aria-label="Buscar aulas prontas"'));ok(html.includes("Usar aula"));}
  const supportHtml=await guest.request(`/aulas-prontas/${id}/texto`);ok(supportHtml.includes("Imprimir texto"));ok(supportHtml.includes(first.supportText.paragraphs[1]));await guest.request("/aulas-prontas/missing/texto",undefined,404);
  const landing=await guest.request("/");ok(landing.includes("Aulas prontas por disciplina"));
  await guest.request("/api/presentations",{deck:first.presentation,revision:0,writeId:crypto.randomUUID()},401);
  await host.request("/api/profile",{name:"Professora Clara"},201);await other.request("/api/profile",{name:"Outro educador"},201);
  const writeId=crypto.randomUUID(),payload={deck:first.presentation,revision:0,writeId};
  const saved=(await host.request("/api/presentations",payload)).presentation;
  eq((await host.request("/api/presentations",payload)).presentation.revision,1,"Retrying a lost copy acknowledgement creates one lesson.");eq((await host.request("/api/presentations")).presentations.length,1);
  await other.request(`/api/presentations/${saved.deck.id}`,undefined,404);await other.request("/api/presentations",payload,403);
  await other.request("/api/presentations",{deck:second.presentation,revision:0,writeId:crypto.randomUUID()});
  eq((await other.request("/api/presentations")).presentations.length,1);
  const edited={...saved.deck,title:"Aula adaptada pela professora"};await host.request("/api/presentations",{deck:edited,revision:1,writeId:crypto.randomUUID()});eq((await guest.request(`/api/lessons/${id}`)).presentation.title,"Artigo de opinião · Aula 1 · 9º ano");
  const room=await host.request("/api/rooms",{presentationId:edited.id},201),route=`/api/rooms/${room.code}`;
  await alice.request(`${route}/join`,{name:"Ana",avatar:"🦊"},201);await bob.request(`${route}/join`,{name:"Beto",avatar:"🐼"},201);
  let state=await host.request(route),questions=0,clouds=0,pollRounds=0;
  const control=async(action)=>{state=await host.request(`${route}/control`,{action,status:state.status,index:state.index,slideIndex:state.presentation.index,step:state.presentation.step});};
  await control("start");
  for(let moves=0;state.status!=="finished"&&moves<70;moves++){
    const mobile=await alice.request(route);if(mobile.presentation.slide)ok(!("notes" in mobile.presentation.slide));
    if(state.status==="wordcloud"){
      clouds++;const slideId=state.wordCloud.slideId;
      await alice.request(`${route}/word`,{word:"Argumento",slideId,writeId:crypto.randomUUID()},201);
      await bob.request(`${route}/word`,{word:"argumento",slideId,writeId:crypto.randomUUID()},409);
      await bob.request(`${route}/word`,{word:"Respeito",slideId,writeId:crypto.randomUUID()},201);
      await control("end_cloud");
    }else if(state.status==="question"){
      eq(state.endsAt,null);eq(mobile.correct,null);ok(!("correct" in mobile.question));
      const q=deckQuestions(first.presentation)[state.index];await db.prepare("UPDATE rooms SET starts_at = ? WHERE code = ?").bind(Date.now()-20000,room.code).run();
      if(q.kind==="poll"){
        ok(!("counts" in mobile.poll));await alice.request(`${route}/vote`,{index:state.index,choices:[0]});await bob.request(`${route}/vote`,{index:state.index,choices:[1]});pollRounds++;
      }else{
        await alice.request(`${route}/answer`,{index:state.index,option:q.correct});await bob.request(`${route}/answer`,{index:state.index,option:questions===0?(q.correct+1)%q.options.length:q.correct});questions++;
      }
      state=await host.request(route);eq(state.status,"results");eq(state.explanation,q.explanation);await control("next");
    }else await control("next");
  }
  eq(state.status,"finished");eq(questions,7);eq(pollRounds,4);eq(clouds,1);eq(state.players.find(p=>p.name==="Ana").score,7100);eq(state.players.find(p=>p.name==="Beto").score,6100);
  const report=await host.request(`/api/reports/${room.code}`);eq(report.completed,11);eq(report.gradingTotal,7);eq(report.pollVotes.length,8);eq(report.wordClouds[0].words.length,2);
  await host.request("/api/auth/register",{name:"Professora Clara",email:"teacher@example.test",password:"senha-segura-para-testes"},201);const linked=await host.request("/api/account/link",{});ok(linked.profile.permanent);eq((await host.request(`/api/presentations/${edited.id}`)).presentation.deck.title,edited.title,"The selected lesson survives linking a temporary account.");
  console.log(`✓ ${checks} ready-lesson checks: subject/year/accent search, public browsing, editable independent masters/copies, bounded trusted images, complete reading, printable support, ownership/idempotent saves, live questions/cloud, reports and account migration.`);
}finally{if(mf)await mf.dispose();await fs.rm(temp,{recursive:true,force:true});}
