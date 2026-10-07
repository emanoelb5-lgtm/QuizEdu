import { answer, appManifest, body, controlRoom, createRoom, dashboard, deleteQuiz, HttpError, joinRoom, json, profile, resumePlayer, roomState, roomEvents, saveQuiz } from "@/lib/server";
import { copySharedQuiz, deleteDraft, deleteQuestion, linkAccount, listQuestions, logout, readImage, reportCsv, reportData, saveDraft, saveQuestion, sharedQuiz, shareQuiz, unshareQuiz, uploadImage } from "@/lib/library-server";
import { heartbeat } from "@/lib/server";
import {deletePresentation,listPresentations,readPresentation,savePresentation} from "@/lib/presentation-server";
import {approveNative,listNative,nativeInfo,nativeStatus,revokeNative,startNative} from "@/lib/native-server";
import {androidSigning} from "@/lib/android-signing";
import {readPresentationImport} from "@/lib/presentation-import-server";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    const path = new URL(request.url).pathname.slice(5).split("/").filter(Boolean); const method = request.method;
    if(method==="POST"&&path.join("/")==="android/signing")return await androidSigning(request);
    if(method==="POST"&&path.join("/")==="presentation-import")return await readPresentationImport(request);
    if(path[0]==="native"){
      if(method==="POST"&&path.join("/")==="native/start")return await startNative(request);
      if(method==="POST"&&path.join("/")==="native/status")return await nativeStatus(request);
      if(method==="POST"&&path.join("/")==="native/approve")return await approveNative(request);
      if(method==="GET"&&path.join("/")==="native/devices")return await listNative(request);
      if(method==="GET"&&path[1]==="requests"&&path.length===3)return await nativeInfo(path[2]);
      if(method==="DELETE"&&path[1]==="devices"&&path.length===3)return await revokeNative(request,path[2]);
    }
    if (method === "GET" && path.join("/") === "ping") return json({serverNow:Date.now()});
    if (method === "GET" && path.join("/") === "app-manifest") return await appManifest(request);
    if (method === "GET" && path[0] === "dashboard" && path.length === 1) return await dashboard(request);
    if (path[0] === "presentations") {
      if (method === "GET" && path.length === 1) return await listPresentations(request);
      if (method === "GET" && path.length === 2) return await readPresentation(request,path[1]);
      if (method === "POST" && path.length === 1) return await savePresentation(request);
      if (method === "DELETE" && path.length === 2) return await deletePresentation(request,path[1]);
    }
    if (method === "POST" && path[0] === "profile" && path.length === 1) return await profile(request);
    if (method === "POST" && path.join("/") === "account/link") return await linkAccount(request);
    if (method === "POST" && path.join("/") === "logout") return await logout(request);
    if (method === "POST" && path[0] === "drafts" && path.length === 1) return await saveDraft(request);
    if (method === "DELETE" && path[0] === "drafts" && path.length === 2) return await deleteDraft(request,path[1]);
    if (method === "GET" && path[0] === "questions" && path.length === 1) return await listQuestions(request);
    if (method === "POST" && path[0] === "questions" && path.length === 1) return await saveQuestion(request);
    if (method === "DELETE" && path[0] === "questions" && path.length === 2) return await deleteQuestion(request,path[1]);
    if (method === "POST" && path[0] === "media" && path.length === 1) return await uploadImage(request);
    if (method === "GET" && path[0] === "media" && path.length === 2) return await readImage(path[1]);
    if (path[0] === "reports" && path.length >= 2) {
      if (method === "GET" && path.length === 2) return json(await reportData(request,path[1]));
      if (method === "GET" && path.length === 3 && path[2] === "csv") return await reportCsv(request,path[1]);
    }
    if (path[0] === "shares" && path.length >= 2) {
      if (method === "GET" && path.length === 2) return json({quiz:await sharedQuiz(path[1])});
      if (method === "POST" && path.length === 3 && path[2] === "copy") return await copySharedQuiz(request,path[1]);
    }
    if (method === "POST" && path[0] === "quizzes" && path.length === 1) return await saveQuiz(request);
    if (method === "DELETE" && path[0] === "quizzes" && path.length === 2) return await deleteQuiz(request, path[1]);
    if (path[0] === "quizzes" && path.length === 3 && path[2] === "share") {
      if(method === "POST") return await shareQuiz(request,path[1]);
      if(method === "DELETE") return await unshareQuiz(request,path[1]);
    }
    if (method === "POST" && path[0] === "rooms" && path.length === 1) return await createRoom(request);
    if (path[0] === "rooms" && path.length >= 2) {
      if (method === "GET" && path.length === 3 && path[2] === "events") return await roomEvents(request, path[1]);
      if (method === "GET" && path.length === 2) return await roomState(request, path[1]);
      if (method === "POST" && path.length === 3) {
        if (path[2] === "join") return await joinRoom(request, path[1]);
        if (path[2] === "resume") return await resumePlayer(request, path[1]);
        if (path[2] === "answer") return await answer(request, path[1]);
        if (path[2] === "control") return await controlRoom(request, path[1]);
        if (path[2] === "heartbeat") return await heartbeat(request,path[1]);
      }
    }
    return json({ error: "Página não encontrada." }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("QuizEdu request failed", (e as Error).message);
    return json({ error: "Não foi possível concluir agora. Seus dados continuam na tela. Tente novamente." }, 503);
  }
}
export const GET = handle; export const POST = handle; export const DELETE = handle;
