import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import {pathToFileURL} from "node:url";
import ts from "typescript";

const temp=await fs.mkdtemp(path.join(os.tmpdir(),"quizedu-install-"));
let checks=0;
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
try {
  const source=await fs.readFile("lib/app-install.ts","utf8");
  const file=path.join(temp,"app-install.mjs");
  await fs.writeFile(file,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
  const {INSTALL_BOOTSTRAP}=await import(pathToFileURL(file));
  function browser({supported=true,standalone=false,safariStandalone=false,ios=false,ipad=false}={}) {
    const handlers=new Map();const mediaHandlers=new Map();
    const media={matches:standalone,addEventListener:(name,handler)=>mediaHandlers.set(name,handler)};
    const window={matchMedia:()=>media,addEventListener:(name,handler)=>{const listeners=handlers.get(name)||[];listeners.push(handler);handlers.set(name,listeners);}};
    if(supported)window.onbeforeinstallprompt=null;
    const navigator={userAgent:ios?"iPhone":"Chrome",platform:ipad?"MacIntel":"Linux",maxTouchPoints:ipad?5:1,standalone:safariStandalone};
    const context={window,navigator};
    vm.runInNewContext(INSTALL_BOOTSTRAP,context);
    const emit=(name,event={})=>{for(const handler of handlers.get(name)||[])handler(event);};
    return {window,navigator,media,context,emit,mediaHandlers,handlers,app:window.__quizEduInstall};
  }
  let inClick=false;let calls=0;let prevented=0;
  function event(outcome="accepted",options={}) {
    return {preventDefault:()=>prevented++,userChoice:Promise.resolve({outcome}),prompt(){
      eq(inClick,true,"The browser prompt is called synchronously in the click, preserving user activation.");calls++;
      if(options.throw)throw new Error("Unavailable");
      return options.promise || Promise.resolve(options.legacy?undefined:{outcome});
    }};
  }
  function click(app){inClick=true;try{return app.install();}finally{inClick=false;}}

  const early=browser();eq(early.app.getState().status,"waiting");
  eq(await click(early.app),"unavailable");eq(calls,0);
  early.emit("beforeinstallprompt",event());eq(early.app.getState().status,"ready");eq(calls,0,"An early click never queues a prompt without a new user gesture.");eq(prevented,1);
  let notifications=0;const unsubscribe=early.app.subscribe(()=>notifications++);
  eq(early.app.getState().status,"ready","Hydration can read an event captured before it subscribed.");
  const first=click(early.app);eq(calls,1,"The native function has run before the click handler returns.");eq(early.app.getState().status,"prompting");
  eq(await click(early.app),"unavailable");eq(calls,1,"Repeated clicks do not reuse a consumed browser event.");
  eq(await first,"accepted");eq(early.app.getState().status,"installed");eq(notifications,2);unsubscribe();
  early.emit("beforeinstallprompt",event());eq(early.app.getState().status,"installed");eq(await click(early.app),"unavailable");eq(calls,1);

  const late=browser();let latest=late.app.getState().status;late.app.subscribe(()=>latest=late.app.getState().status);
  late.emit("beforeinstallprompt",event("dismissed"));eq(latest,"ready","An event after hydration enables the native install button.");
  eq(await click(late.app),"dismissed");eq(latest,"dismissed");eq(await click(late.app),"unavailable");
  late.emit("beforeinstallprompt",event("accepted",{legacy:true}));eq(latest,"ready");eq(await click(late.app),"accepted","Older implementations exposing userChoice still install.");eq(latest,"installed");

  for(const options of [{throw:true},{promise:Promise.reject(new Error("Rejected"))}]) {
    const failed=browser();failed.emit("beforeinstallprompt",event("accepted",options));
    eq(await click(failed.app),"error");eq(failed.app.getState().status,"error");eq(await click(failed.app),"unavailable");
    failed.emit("beforeinstallprompt",event());eq(await click(failed.app),"accepted","A fresh browser event permits retrying a failed installation.");
  }
  const installed=browser();let finish;
  const pending=new Promise(resolve=>finish=resolve);installed.emit("beforeinstallprompt",event("dismissed",{promise:pending}));
  const waiting=click(installed.app);installed.emit("appinstalled");finish({outcome:"dismissed"});await waiting;
  eq(installed.app.getState().status,"installed","A late prompt result cannot undo an appinstalled event.");
  const rejectAfterInstall=browser();let reject;
  const rejected=new Promise((_,fail)=>reject=fail);rejectAfterInstall.emit("beforeinstallprompt",event("accepted",{promise:rejected}));
  const attempting=click(rejectAfterInstall.app);rejectAfterInstall.emit("appinstalled");reject(new Error("Late failure"));await attempting;eq(rejectAfterInstall.app.getState().status,"installed");

  const manual=browser({supported:false});eq(manual.app.getState().status,"manual");eq(await click(manual.app),"unavailable");
  manual.emit("beforeinstallprompt",event());eq(manual.app.getState().status,"ready","An actual browser event overrides conservative feature detection.");
  for(const config of [{ios:true},{ipad:true}]){const apple=browser(config);eq(apple.app.getState().status,"manual");eq(apple.app.getState().ios,true);eq(await click(apple.app),"unavailable");}
  const standalone=browser({standalone:true});eq(standalone.app.getState().status,"installed");eq(await click(standalone.app),"unavailable");
  const iosApp=browser({ios:true,safariStandalone:true});eq(iosApp.app.getState().status,"installed");eq(await click(iosApp.app),"unavailable");
  const mediaChange=browser();const stop=mediaChange.app.subscribe(()=>notifications++);stop();const oldNotifications=notifications;
  mediaChange.media.matches=true;mediaChange.mediaHandlers.get("change")();eq(mediaChange.app.getState().status,"installed");eq(notifications,oldNotifications,"Unmounted UI subscriptions are removed.");
  const same=late.app;vm.runInNewContext(INSTALL_BOOTSTRAP,late.context);eq(late.window.__quizEduInstall,same);eq(late.handlers.get("beforeinstallprompt").length,1,"Running the head script twice does not register duplicate handlers.");
  const external=browser();external.emit("appinstalled");eq(external.app.getState().status,"installed","Installing from the browser menu hides the invitation too.");
  console.log(`✓ Native install prompt, early/late availability, click activation, cancellation, retry, repeated clicks and standalone mode. ${checks} checks passed.`);
} finally {await fs.rm(temp,{recursive:true,force:true});}
