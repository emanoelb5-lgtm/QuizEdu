import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import ts from "typescript";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

const temp=await fs.mkdtemp(path.join(os.tmpdir(),"prativerso-display-"));let checks=0;
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const ok=(v,message)=>{assert.ok(v,message);checks++;};
try {
  await fs.writeFile(path.join(temp,"package.json"),'{"type":"module"}');
  const files={quiz:"lib/quiz.ts",presentation:"lib/presentation.ts","presentation-display":"lib/presentation-display.ts","live-clock":"lib/live-clock.ts",utils:"lib/utils.ts",canvas:"app/ui/slide-canvas.tsx","poll-view":"app/ui/poll-view.tsx","round-ranking":"app/ui/round-ranking.tsx","presentation-live":"app/ui/presentation-live.tsx","presentation-chrome":"app/ui/presentation-chrome.ts","student-ranking":"app/ui/student-ranking.tsx","room-shared":"app/ui/room-shared.tsx","action-dock":"app/ui/action-dock.tsx",button:"components/ui/button.tsx",dialog:"components/ui/dialog.tsx","alert-dialog":"components/ui/alert-dialog.tsx"};
  const aliases={"@/lib/quiz":"./quiz.js","@/lib/presentation":"./presentation.js","@/lib/presentation-display":"./presentation-display.js","@/lib/live-clock":"./live-clock.js","@/lib/utils":"./utils.js","@/components/ui/button":"./button.js","@/components/ui/dialog":"./dialog.js","@/components/ui/alert-dialog":"./alert-dialog.js","./slide-canvas":"./canvas.js"};
  for(const [name,file] of Object.entries(files)){
    let code=ts.transpileModule(await fs.readFile(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    for(const [alias,target] of Object.entries(aliases))code=code.replaceAll(JSON.stringify(alias),JSON.stringify(target));
    code=code.replace(/from "\.\/([\w-]+)"/g,'from "./$1.js"');
    for(const dep of ["react","react/jsx-runtime","lucide-react","radix-ui","class-variance-authority","clsx","tailwind-merge","sonner","qrcode"])code=code.replaceAll(JSON.stringify(dep),JSON.stringify(import.meta.resolve(dep)));
    await fs.writeFile(path.join(temp,name+".js"),code);
  }
  // Existing network, notifications and avatar selection are unrelated to
  // display behavior; render the actual presentation/ranking components.
  await fs.writeFile(path.join(temp,"shared.js"),`import React from ${JSON.stringify(import.meta.resolve("react"))};export const api=async()=>({});export const useClock=()=>0;export const Notifications=()=>null;export const Brand=()=>React.createElement("span",null,"Prativerso");export const Offline=({text})=>React.createElement("p",null,text);`);
  await fs.writeFile(path.join(temp,"avatar-picker.js"),`import React from ${JSON.stringify(import.meta.resolve("react"))};export const AvatarImage=({value,size=40})=>React.createElement("img",{src:"/avatars/"+value+".svg",alt:"",width:size,height:size});`);
  const {RankingSpotlightSequence,RANKING_SPOTLIGHT_MS,spotlightRemaining,cloudWordAppearance}=await import(pathToFileURL(path.join(temp,"presentation-display.js")));
  const {newSlide,newDeck,wordCloudSlide,questionSlide,sampleDeck}=await import(pathToFileURL(path.join(temp,"presentation.js")));
  const {sampleQuiz}=await import(pathToFileURL(path.join(temp,"quiz.js")));
  const sequence=new RankingSpotlightSequence();
  const room={code:"123456",status:"slide",index:-1,presentation:{review:false,blackout:false}};
  eq(sequence.observe(room,100),null);
  eq(sequence.observe({...room,status:"question",index:0},200),null,"An in-progress question never automatically covers the slide.");
  const result={...room,status:"results",index:0};const flash=sequence.observe(result,300);
  eq(flash.endsAt,300+RANKING_SPOTLIGHT_MS);eq(RANKING_SPOTLIGHT_MS,6000);
  eq(sequence.observe(result,700),undefined,"Repeated server updates do not restart the six-second timer.");
  eq(sequence.observe({...result,status:"slide"},800),undefined,"A content slide can retain the current brief announcement.");
  ok(spotlightRemaining(flash,5000)>0);eq(spotlightRemaining(flash,6300),0);eq(spotlightRemaining(flash,20000),0);
  eq(sequence.observe({...result,presentation:{review:true,blackout:false}},900),null);
  eq(sequence.observe(result,1000),undefined,"Review does not reannounce a completed round.");
  eq(sequence.observe({...result,status:"question",index:1},1200),null);
  eq(sequence.observe({...result,index:1},1300).endsAt,7300,"The next completed round gets a fresh announcement.");
  eq(sequence.observe({...result,presentation:{blackout:true,review:false}},1500),null);
  eq(sequence.observe({...result,status:"wordcloud"},1600),null);
  eq(sequence.observe({...result,status:"finished"},1700),null);
  ok(sequence.observe({...result,code:"654321"},1800).key.startsWith("654321:"),"Entering another room resets announcement history.");
  const lagging=new RankingSpotlightSequence();lagging.observe({...room,status:"question",index:0},2000);
  ok(lagging.observe({...result,status:"slide"},2200),"A projector still announces the result if the teacher advances before its results update arrives.");
  eq(lagging.observe({...result,status:"slide"},2400),undefined,"A missed-results announcement also happens only once.");

  const looks=Array.from({length:100},(_,i)=>cloudWordAppearance(`word-${i}`,12,8));
  ok(new Set(looks.map(s=>s.fontSize)).size>5,"Words have visibly varied sizes.");
  ok(new Set(looks.map(s=>s.color)).size>3);ok(new Set(looks.map(s=>s.delay)).size>10,"Motion is staggered instead of synchronized.");
  for(const [i,look] of looks.entries()){
    eq(look,cloudWordAppearance(`word-${i}`,12,8),"Live polling preserves the same word's motion phase.");
    ok(look.fontSize>=14&&look.fontSize<=100&&look.duration>=7&&look.duration<=12);
    const crowded=cloudWordAppearance(`word-${i}`,1000,40);
    ok(crowded.fontSize<=look.fontSize&&crowded.fontSize>=14,"A crowded cloud remains bounded and readable.");
  }
  const {CloudSlideContent}=await import(pathToFileURL(path.join(temp,"canvas.js")));
  const words=Array.from({length:1000},(_,i)=>({id:`word-${i}`,word:`Palavra${i}`}));
  const cloud=renderToStaticMarkup(React.createElement(CloudSlideContent,{prompt:"Ideias da turma",words}));
  eq((cloud.match(/role="listitem"/g)||[]).length,1000,"Every submitted word remains visible in the scrollable cloud.");
  eq((cloud.match(/cloud-word-moving/g)||[]).length,120,"Bound continuous animations in large classes.");
  ok(cloud.includes("100 pontos por palavra nova"));ok(cloud.includes("Palavra999"));
  const hostile=renderToStaticMarkup(React.createElement(CloudSlideContent,{prompt:"Tema",words:[{id:"bad",word:"<script>"}]}));ok(!hostile.includes("<script>"));

  const players=Array.from({length:8},(_,i)=>({id:`player-${i}`,name:`Estudante ${i+1}`,avatar:"adventurer-01",score:8000-i*1000,position:i+1,correctCount:8-i,totalMs:0,answered:true,roundPoints:1000,roundCorrect:true}));
  const state={code:"123456",title:"Aula de exemplo",teacher:"Professor",status:"slide",index:-1,total:6,startsAt:null,endsAt:null,serverNow:0,version:"1",players,answeredCount:0,isHost:false,me:{...players[6],option:null},mode:"accuracy",untimed:true,expiresAt:Date.now()+86400000,presentation:{id:"deck",index:0,total:14,step:0,steps:0,blackout:false,slide:newSlide("cover"),questionIndex:-1,review:false,theme:"prativerso",showSlideNumbers:true,outline:[]}};
  const {StudentRanking}=await import(pathToFileURL(path.join(temp,"student-ranking.js")));
  for(const status of ["lobby","slide","wordcloud","question","results","finished","closed"]){
    const html=renderToStaticMarkup(React.createElement(StudentRanking,{state:{...state,status}}));
    ok(html.includes("Ranking ao vivo"),`${status}: the ranking is always displayed.`);
    eq((html.match(/<li /g)||[]).length,8,"The complete ranking includes students outside the top five.");
    ok(html.includes("7º lugar")&&html.includes('aria-current="true"'));ok(html.includes("Estudante 8"));
  }
  eq(renderToStaticMarkup(React.createElement(StudentRanking,{state:{...state,me:null}})),"","The join form is not covered by a participant-only ranking.");
  const {RoundRankingOverlay}=await import(pathToFileURL(path.join(temp,"round-ranking.js")));
  const overlay=renderToStaticMarkup(React.createElement(RoundRankingOverlay,{players,onClose:()=>{}}));
  eq((overlay.match(/<li /g)||[]).length,5);ok(overlay.includes("5 primeiros"));ok(overlay.includes('aria-label="Fechar ranking"'));
  const {PresentationLive,DeckPreview}=await import(pathToFileURL(path.join(temp,"presentation-live.js")));
  for(const projection of [false,true]){
    const html=renderToStaticMarkup(React.createElement(PresentationLive,{state:{...state,isHost:true},projection,error:"",apply:()=>{},refresh:async()=>{}}));
    ok(html.includes("lesson-immersive"));ok(html.includes("slide-frame"));ok(!html.includes('class="lesson-live-ranking"'),"No permanent ranking column reduces the slide.");
    ok(html.includes('aria-label="Tela inteira"'));ok(html.includes('aria-label="Ver ranking"'));
    eq(html.includes("lesson-control-dock"),!projection,"The separate projector never exposes teacher controls.");
  }
  const preview=renderToStaticMarkup(React.createElement(DeckPreview,{deck:sampleDeck(),onClose:()=>{}}));ok(preview.includes("lesson-preview-immersive"));
  const styles=await fs.readFile("app/presentation-display.css","utf8"),cloudStyles=await fs.readFile("app/word-cloud.css","utf8");
  ok(styles.includes("prefers-reduced-motion:reduce")&&cloudStyles.includes("prefers-reduced-motion:reduce"),"Reduced-motion users retain the layout without continuous motion.");
  const playerSource=await fs.readFile("app/ui/player-room.tsx","utf8");ok(playerSource.includes("{me&&<StudentRanking state={state}/>}")&&!playerSource.includes('state.status==="results"&&<StudentRanking'),"Ranking is independent of the current response phase.");
  console.log(`✓ ${checks} display checks: stable cloud sizes/motion, 1,000 words with bounded animations, single six-second result announcements, review/new-question resets, immersive live/preview surfaces and persistent complete student rankings.`);
} finally {await fs.rm(temp,{recursive:true,force:true});}
