import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {createRequire} from "node:module";
import {generateKeyPairSync,sign} from "node:crypto";
const require=createRequire(import.meta.resolve("wrangler"));const {Miniflare,createFetchMock}=require("miniflare");
const origin="https://quizedu-emanuel.emanuelb5.chatgpt.site",audience=origin+"/api/android/signing";
let checks=0,mf;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},ok=(a,m)=>{assert.ok(a,m);checks++;};
const hash=async value=>Buffer.from(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))).toString("hex"),secret=()=>crypto.getRandomValues(new Uint8Array(32)).reduce((s,n)=>s+n.toString(16).padStart(2,"0"),"");
const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});const jwk={...publicKey.export({format:"jwk"}),kid:"quizedu-test-key",use:"sig",alg:"RS256"};
const fetchMock=createFetchMock();fetchMock.disableNetConnect();fetchMock.get("https://token.actions.githubusercontent.com").intercept({path:"/.well-known/jwks",method:"GET"}).reply(200,{keys:[jwk]},{headers:{"Content-Type":"application/json"}}).persist();
const testBundle={keystore:"TEST_ONLY_PRIVATE_BUNDLE",storePassword:"TEST_ONLY_PASSWORD",keyPassword:"TEST_ONLY_PASSWORD",keyAlias:"quizedu",certificateSha256:"a".repeat(64)};
const now=Math.floor(Date.now()/1000),claims={iss:"https://token.actions.githubusercontent.com",aud:audience,sub:"repo:emanoelb5-lgtm/QuizEdu:ref:refs/heads/main",repository:"emanoelb5-lgtm/QuizEdu",repository_id:"1407486285",repository_owner_id:"305669201",ref:"refs/heads/main",ref_type:"branch",event_name:"push",workflow_ref:"emanoelb5-lgtm/QuizEdu/.github/workflows/android.yml@refs/heads/main",runner_environment:"github-hosted",iat:now,nbf:now-5,exp:now+300};
const jwt=(payload=claims,header={alg:"RS256",typ:"JWT",kid:jwk.kid},key=privateKey)=>{const parts=[header,payload].map(v=>Buffer.from(JSON.stringify(v)).toString("base64url")).join(".");return parts+"."+sign("RSA-SHA256",Buffer.from(parts),key).toString("base64url");};
async function walk(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else if(/\.m?js$/.test(p))out.push(p);}return out;}
const entry=path.resolve("dist/server/index.js"),modules=[entry,...(await walk(path.resolve("dist/server"))).filter(p=>p!==entry)].map(p=>({type:"ESModule",path:p}));
let clientNumber=0;
class Client{
 cookies=new Map();identity=null;bearer=null;ip=`192.0.2.${++clientNumber}`;
 async raw(route,data,method,extra={}){return mf.dispatchFetch(origin+route,{method:method||(data===undefined?"GET":"POST"),headers:{"CF-Connecting-IP":this.ip,cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join("; "),...(this.identity?{"oai-authenticated-user-id":this.identity.id,"oai-authenticated-user-email":this.identity.email}:{}),...(this.bearer?{Authorization:`Bearer ${this.bearer}`} : {}),...(data===undefined?{}:{"Content-Type":"application/json",Origin:origin}),...extra},body:data===undefined?undefined:JSON.stringify(data)});}
 async request(route,data,status=200,method,extra){const r=await this.raw(route,data,method,extra);for(const c of r.headers.getSetCookie()){const pair=c.split(";")[0],i=pair.indexOf("=");this.cookies.set(pair.slice(0,i),pair.slice(i+1));}const text=await r.text();let result;try{result=JSON.parse(text);}catch{result=text;}eq(r.status,status,`${route}: ${text.slice(0,220)}`);return result;}
}
try{
 mf=new Miniflare({modules,modulesRoot:path.resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"quizedu-native-tests"},r2Buckets:["BUCKET"],bindings:{ANDROID_SIGNING_BUNDLE:JSON.stringify(testBundle)},fetchMock});
 const database=await mf.getD1Database("DB");for(const f of (await fs.readdir("drizzle")).filter(f=>f.endsWith(".sql")).sort())for(const s of (await fs.readFile(`drizzle/${f}`,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await database.prepare(s).run();
 const anonymous=new Client(),browser=new Client(),phone=new Client(),other=new Client(),student=new Client();
 await anonymous.request("/api/native/devices",undefined,401);await anonymous.request("/api/native/start",{challenge:"short",deviceName:"Android"},400);
 const token=secret(),start=await phone.request("/api/native/start",{challenge:await hash(token),deviceName:"Android do professor"},201);
 ok(start.path.startsWith("/vincular-app?id="));ok(!JSON.stringify(start).includes(token));
 const info=await anonymous.request(`/api/native/requests/${start.id}`);eq(info.approved,false);eq(info.deviceName,"Android do professor");ok(!("secretHash" in info));
 await phone.request("/api/native/start",{challenge:await hash(token),deviceName:"Outro Android"},409);
 eq((await phone.request("/api/native/status",{id:start.id,verifier:token})).status,"pending");await other.request("/api/native/status",{id:start.id,verifier:secret()},410);
 await anonymous.request("/api/native/approve",{id:start.id},401);await browser.request("/api/native/approve",{id:start.id},403,undefined,{Origin:"https://evil.test"});
 browser.identity={id:"native-teacher-account",email:"professor@example.test"};
 const approval=await browser.request("/api/native/approve",{id:start.id});ok(approval.profile.permanent);
 const completed=await phone.request("/api/native/status",{id:start.id,verifier:token});eq(completed.profile.id,approval.profile.id);eq(completed.status,"approved");
 phone.bearer=token;eq((await phone.request("/api/dashboard")).profile.id,approval.profile.id);
 phone.cookies=new Map();eq((await phone.request("/api/dashboard")).profile.id,approval.profile.id,"An Android bearer works independently of browser cookies.");
 await phone.request("/api/native/approve",{id:start.id},403);
 await other.request("/api/profile",{name:"Outro professor"},201);await other.request("/api/native/approve",{id:start.id},409);
 const deck={id:crypto.randomUUID(),title:"Aula criada no Android",subject:"Ciências",topic:"Solo",theme:"azul",mode:"speed",untimed:false,showSlideNumbers:true,slides:[{id:crypto.randomUUID(),kind:"content",title:"Introdução",notes:"ANOTAÇÃO PRIVADA",background:{color:"#ffffff"},transition:"fade",elements:[]},{id:crypto.randomUUID(),kind:"question",title:"Quiz",notes:"RESPOSTA PRIVADA",background:{color:"#ffffff"},transition:"fade",elements:[],question:{id:crypto.randomUUID(),kind:"multiple",text:"Qual prática protege o solo?",options:["Cobertura vegetal","Solo descoberto"],correct:0,seconds:30,explanation:"A cobertura vegetal protege o solo."}}]};
 const writeId=crypto.randomUUID(),saved=(await phone.request("/api/presentations",{deck,revision:0,writeId})).presentation;eq(saved.revision,1);eq((await browser.request(`/api/presentations/${deck.id}`)).presentation.deck.title,deck.title);
 await other.request(`/api/presentations/${deck.id}`,undefined,404);await phone.request("/api/presentations",{deck,revision:0,writeId:crypto.randomUUID()},409);
 const retry=await phone.request("/api/presentations",{deck,revision:0,writeId});eq(retry.presentation.revision,1);
 const room=await phone.request("/api/rooms",{presentationId:deck.id},201),route=`/api/rooms/${room.code}`;
 await student.request(`${route}/join`,{name:"Luana",avatar:"🦁"},201);
 let state=await phone.request(route);ok(state.isHost);const control=(action)=>phone.request(`${route}/control`,{action,index:state.index,status:state.status,slideIndex:state.presentation.index,step:state.presentation.step});
 state=await control("start");eq(state.status,"slide");eq(state.presentation.slide.notes,"ANOTAÇÃO PRIVADA");
 let publicState=await student.request(route);eq(publicState.me.name,"Luana");ok(!JSON.stringify(publicState).includes("ANOTAÇÃO PRIVADA"));ok(!publicState.presentation.outline);ok(!publicState.isHost);
 const old=state;state=await control("next");eq(state.status,"question");await phone.request(`${route}/control`,{action:"next",index:old.index,status:old.status,slideIndex:old.presentation.index,step:old.presentation.step},409);
 publicState=await student.request(route);eq(publicState.correct,null);ok(!("correct" in publicState.question));ok(!JSON.stringify(publicState).includes("RESPOSTA PRIVADA"));
 await other.request(`${route}/control`,{action:"end_round",index:state.index,status:state.status,slideIndex:state.presentation.index,step:state.presentation.step},403);
 await database.prepare("UPDATE rooms SET starts_at = ?,ends_at = ? WHERE code = ?").bind(Date.now()-1000,Date.now()+29000,room.code).run();
 await student.request(`${route}/answer`,{index:0,option:0});await student.request(`${route}/answer`,{index:0,option:0});
 const restored=new Client();restored.cookies=new Map(student.cookies);eq((await restored.request(route)).me.id,(await student.request(route)).me.id);
 state=await phone.request(route);if(state.status==="question")state=await control("end_round");eq(state.status,"results");eq((await restored.request(route)).me.score,1000);eq((await database.prepare("SELECT COUNT(*) n FROM answers WHERE room = ?").bind(room.code).first()).n,1);
 const listed=(await phone.request("/api/native/devices")).devices;eq(listed.length,1);eq(listed[0].id,start.id);ok(!JSON.stringify(listed).includes(token));
 await other.request(`/api/native/devices/${start.id}`,{},200,"DELETE");eq((await phone.request("/api/native/devices")).devices.length,1);
 await browser.request(`/api/native/devices/${start.id}`,{},200,"DELETE");await phone.request("/api/presentations",undefined,401);eq((await phone.request("/api/dashboard")).profile,null);await phone.request("/api/native/status",{id:start.id,verifier:token},410);
 // A phone's temporary account can be imported only after it proves ownership
 // when starting the pairing. The chosen browser account owns the migration.
 const temp=new Client();const tempProfile=(await temp.request("/api/profile",{name:"Temporário no Android"},201)).profile;
 const tempDeck={...deck,id:crypto.randomUUID()};await temp.request("/api/presentations",{deck:tempDeck,revision:0,writeId:crypto.randomUUID()});
 const temporaryToken=secret(),tempStart=await temp.request("/api/native/start",{challenge:await hash(temporaryToken),deviceName:"Meu Android"},201);eq((await anonymous.request(`/api/native/requests/${tempStart.id}`)).hasTemporaryLessons,true);
 await browser.request("/api/native/approve",{id:tempStart.id,importTemporary:true});temp.bearer=temporaryToken;temp.cookies.clear();eq((await temp.request(`/api/presentations/${tempDeck.id}`)).presentation.deck.id,tempDeck.id);eq((await temp.request("/api/dashboard")).profile.id,approval.profile.id);ok((await database.prepare("SELECT expires_at FROM educators WHERE id = ?").bind(tempProfile.id).first()).expires_at<=Date.now());
 const expiredToken=secret(),expired=await anonymous.request("/api/native/start",{challenge:await hash(expiredToken),deviceName:"Android expirado"},201);await database.prepare("UPDATE native_sessions SET expires_at = ? WHERE id = ?").bind(Date.now()-1,expired.id).run();await anonymous.request(`/api/native/requests/${expired.id}`,undefined,410);await browser.request("/api/native/approve",{id:expired.id},410);await anonymous.request("/api/native/status",{id:expired.id,verifier:expiredToken},410);
 const invalidBearer=new Client();invalidBearer.identity=browser.identity;invalidBearer.cookies=new Map(browser.cookies);invalidBearer.bearer=secret();eq((await invalidBearer.request("/api/dashboard")).profile,null,"An invalid native token cannot fall back to another identity.");
 const limited=new Client();for(let i=0;i<12;i++)await limited.request("/api/native/start",{challenge:await hash(secret()),deviceName:"Android"},201);await limited.request("/api/native/start",{challenge:await hash(secret()),deviceName:"Android"},429);
 const page=await anonymous.request(`/vincular-app?id=${tempStart.id}`);ok(page.includes("QuizEdu")&&page.includes("vincular"));ok(!page.includes(temporaryToken));
 console.log(`✓ Browser-approved device linking, verifier privacy, expiry/revocation, ownership, account migration, CAS edits, native controls, student privacy and restored scores. ${checks} checks so far.`);
 // The same bounded importer is available to a linked Android via its bearer token.
 const importHeaders = {"Content-Type":"application/octet-stream",Origin:origin,"X-Presentation-Name":"Aula.json",Authorization:`Bearer ${temporaryToken}`};
 const rawDeck = JSON.stringify(deck);
 let importedResponse = await mf.dispatchFetch(origin+"/api/presentation-import",{method:"POST",headers:importHeaders,body:rawDeck});eq(importedResponse.status,200);const importedDeck=await importedResponse.json();eq(importedDeck.deck.title,deck.title);eq(importedDeck.assets,[]);
 importedResponse = await mf.dispatchFetch(origin+"/api/presentation-import",{method:"POST",headers:{...importHeaders,Origin:"https://other.test"},body:rawDeck});eq(importedResponse.status,403);await importedResponse.arrayBuffer();
 importedResponse = await mf.dispatchFetch(origin+"/api/presentation-import",{method:"POST",headers:{...importHeaders,Authorization:`Bearer ${secret()}`},body:rawDeck});eq(importedResponse.status,401);await importedResponse.arrayBuffer();
 importedResponse = await mf.dispatchFetch(origin+"/api/presentation-import",{method:"POST",headers:{...importHeaders,"X-Presentation-Name":"Aula.pptx"},body:"not a presentation"});eq(importedResponse.status,400);await importedResponse.arrayBuffer();
 // Verify the actual compiled Worker against a local JWKS fixture. Every token
 // is genuinely RSA-signed; no live GitHub identity or production key is used.
 const ci=new Client();await ci.request("/api/android/signing",{},401);ci.bearer=jwt();eq(await ci.request("/api/android/signing",{}),testBundle);
 ci.bearer=jwt({...claims,sub:"repo:emanoelb5-lgtm@305669201/QuizEdu@1407486285:ref:refs/heads/main"});eq((await ci.request("/api/android/signing",{})).keyAlias,"quizedu");
 ci.bearer=jwt({...claims,sub:"repo:emanoelb5-lgtm@305669201/QuizEdu@1407486285:ref:refs/heads/main",job_workflow_ref:claims.workflow_ref});eq((await ci.request("/api/android/signing",{})).certificateSha256,testBundle.certificateSha256,"GitHub ordinary-job workflow claims must match the same trusted workflow.");
 for(const change of [{repository_id:"1"},{repository_owner_id:"1"},{repository:"other/QuizEdu"},{ref:"refs/heads/other"},{ref_type:"tag"},{event_name:"pull_request"},{runner_environment:"self-hosted"},{workflow_ref:"emanoelb5-lgtm/QuizEdu/.github/workflows/other.yml@refs/heads/main"},{job_workflow_ref:"other/reusable"},{aud:origin},{iss:"https://evil.test"},{sub:"repo:other/QuizEdu:ref:refs/heads/main"},{exp:now-1},{exp:now+10000},{iat:now-1000},{nbf:now+100}]){ci.bearer=jwt({...claims,...change});await ci.request("/api/android/signing",{},403);}
 ci.bearer=jwt(claims,{alg:"none",typ:"JWT",kid:jwk.kid});await ci.request("/api/android/signing",{},403);
 const forged=generateKeyPairSync("rsa",{modulusLength:2048});ci.bearer=jwt(claims,undefined,forged.privateKey);await ci.request("/api/android/signing",{},401);
 ci.bearer=jwt(claims,{alg:"RS256",typ:"JWT",kid:"unknown"});await ci.request("/api/android/signing",{},401);
 const response=await ci.raw("/api/android/signing",{},"POST",{Authorization:`Bearer ${jwt()}`});eq(response.headers.get("cache-control"),"no-store, private");await response.arrayBuffer();
 console.log(`✓ Signed GitHub OIDC validation, immutable owner/repo IDs, audience, branch/workflow/event restrictions, expiry, forged signature rejection and private signing responses. ${checks} native checks passed.`);
}finally{if(mf)await mf.dispose();await fetchMock.close();}
