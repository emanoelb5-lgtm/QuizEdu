import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import ts from "typescript";
import QRCode from "qrcode";
import jsQR from "jsqr";

const require=createRequire(import.meta.resolve("wrangler"));
const sharp=createRequire(require.resolve("miniflare"))("sharp");
const temp=await fs.mkdtemp(path.join(os.tmpdir(),"quizedu-player-app-"));let checks=0;
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const ok=(value,message)=>{assert.ok(value,message);checks++;};
try{
  const source=await fs.readFile("lib/player-app.ts","utf8");await fs.writeFile(path.join(temp,"player-app.mjs"),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
  const {ACTIVE_ROOM_KEY,readActiveRoom,saveActiveRoom,forgetActiveRoom,leaveActiveRoom,initialRoomCode,roomCode,playerManifest}=await import(pathToFileURL(path.join(temp,"player-app.mjs")));
  const values=new Map();const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const now=Date.now();const room={code:"123456",title:"Agroecologia",expiresAt:now+86400000};
  eq(readActiveRoom(storage),null);ok(saveActiveRoom(storage,room));eq(readActiveRoom(storage),room,"Room survives creating a new page session.");
  forgetActiveRoom(storage,"654321");eq(readActiveRoom(storage),room,"Another tab cannot accidentally forget a different room.");forgetActiveRoom(storage,room.code);eq(readActiveRoom(storage),null);
  eq(initialRoomCode(storage,"123456"),"123456","A new installation preserves the scanned room.");saveActiveRoom(storage,room);leaveActiveRoom(storage,"123456");eq(initialRoomCode(storage,"123456"),null,"Leaving persists across relaunches, including the app's original installation URL.");
  saveActiveRoom(storage,{...room,code:"654321"});eq(initialRoomCode(storage,"123456"),"654321","A new room overrides the original installation URL.");leaveActiveRoom(storage,"123456");eq(initialRoomCode(storage,"123456"),"654321","Leaving an old tab does not clear the current room.");forgetActiveRoom(storage);
  for(const bad of ["broken JSON",JSON.stringify({...room,code:123456}),JSON.stringify({...room,code:"12345"}),JSON.stringify({...room,expiresAt:now-1}),JSON.stringify({...room,title:"x".repeat(101)})]){storage.setItem(ACTIVE_ROOM_KEY,bad);eq(readActiveRoom(storage),null);}
  const unavailable={getItem(){throw new Error("Blocked")},setItem(){throw new Error("Full")},removeItem(){throw new Error("Blocked")}};eq(readActiveRoom(unavailable),null);eq(saveActiveRoom(unavailable,room),false);forgetActiveRoom(unavailable);
  const origin="https://quizedu.test";
  for(const value of ["123456"," 123456 ",`${origin}/participar/123456`,"/participar/123456/",`${origin}/jogar?sala=123456`])eq(roomCode(value,origin),"123456");
  for(const value of ["12345","1234567",`${origin}/sala/123456`,"https://other.test/participar/123456","http://quizedu.test/participar/123456","javascript:alert(1)","https://user:pass@quizedu.test/participar/123456",`${origin}/jogar?sala=abcdef`])eq(roomCode(value,origin),null);
  eq(playerManifest().start_url,"/jogar");eq(playerManifest("123456").start_url,"/jogar?sala=123456");eq(playerManifest("12345").start_url,"/jogar");eq(playerManifest("123456").id,playerManifest("654321").id,"All rooms install as one QuizEdu app.");
  const ticket="private-ticket";const entry=new URL(playerManifest("123456",ticket).start_url,origin);eq(new URLSearchParams(entry.hash.slice(1)).get("retomar"),ticket);eq(entry.searchParams.has("retomar"),false);eq(playerManifest().shortcuts[0].url,"/jogar?trocar=1");
  for(const size of [192,512]){const icon=await sharp(`public/app-icon-${size}.png`).metadata();eq([icon.width,icon.height,icon.format],[size,size,"png"]);}
  for(const text of [`${origin}/participar/123456`,"654321"]){const png=await QRCode.toBuffer(text,{margin:3,width:400});const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height);eq(roomCode(decoded.data,origin),text.includes("participar")?"123456":"654321","The camera decoder reads real QuizEdu QR images.");}

  // Run the actual service worker with controlled network and cache interfaces.
  const handlers=new Map();const cacheData=new Map();let installPaths=[];let networkFailed=false;let networkCalls=0;
  const cache={addAll:async values=>{installPaths=values;for(const url of values)cacheData.set(origin+url,new Response(url==="/offline.html"?"OFFLINE":url));},match:async request=>cacheData.get(typeof request==="string"?new URL(request,origin).href:request.url)?.clone(),put:async(request,response)=>cacheData.set(request.url,response),keys:async()=>[...cacheData.keys()].map(url=>({url})),delete:async request=>cacheData.delete(request.url)};
  const caches={open:async()=>cache,match:async value=>cache.match(value),keys:async()=>["quizedu-player-v1","another-app"],delete:async()=>true};
  const self={location:{origin},addEventListener:(name,handler)=>handlers.set(name,handler),skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  const context={self,caches,URL,Response,fetch:async()=>{networkCalls++;if(networkFailed)throw new Error("Offline");return new Response("LIVE");}};
  vm.runInNewContext(await fs.readFile("public/sw.js","utf8"),context);
  let installation;handlers.get("install")({waitUntil:promise=>installation=promise});await installation;eq(Array.from(installPaths),["/offline.html","/favicon.svg","/app-icon-192.png","/app-icon-512.png"]);
  function dispatch(pathname,options={}){let response;handlers.get("fetch")({request:{url:new URL(pathname,origin).href,method:"GET",mode:"cors",destination:"",...options},respondWith:promise=>response=promise});return response;}
  for(const route of ["/api/rooms/123456","/api/app-manifest?sala=123456","/api/dashboard","/signin-with-chatgpt","/signout-with-chatgpt","/callback","/sala/123456","/relatorio/123456","/"]){eq(dispatch(route,{mode:"navigate"}),undefined,"Personal pages and live APIs never use a service worker cache.");}
  eq(dispatch("/api/rooms/123456/answer",{method:"POST"}),undefined);eq(dispatch("/participar/123456?_rsc=1"),undefined);eq(dispatch("https://other.test/jogar",{mode:"navigate"}),undefined);eq(networkCalls,0);
  eq(await (await dispatch("/participar/123456",{mode:"navigate"})).text(),"LIVE");eq(await (await dispatch("/jogar",{mode:"navigate"})).text(),"LIVE");
  networkFailed=true;eq(await (await dispatch("/jogar?sala=123456",{mode:"navigate"})).text(),"OFFLINE");eq(await (await dispatch("/participar/123456",{mode:"navigate"})).text(),"OFFLINE");
  networkFailed=false;eq(await (await dispatch("/assets/app-123.js",{destination:"script"})).text(),"LIVE");networkFailed=true;eq(await (await dispatch("/assets/app-123.js",{destination:"script"})).text(),"LIVE","Public scripts remain available from cache.");
  ok(![...cacheData.keys()].some(url=>url.includes("/api/")||url.includes("/participar/")),"No room state, personal manifest or answer was cached.");
  console.log(`✓ Persistent room selection, room switching, QR parsing/decoding, install icons and safe offline caching. ${checks} checks passed.`);
}finally{await fs.rm(temp,{recursive:true,force:true});}
