import { answer, body, controlRoom, createRoom, dashboard, deleteQuiz, HttpError, joinRoom, json, profile, roomState, saveQuiz } from "@/lib/server";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    const path = new URL(request.url).pathname.slice(5).split("/").filter(Boolean); const method = request.method;
    if (method === "GET" && path[0] === "dashboard" && path.length === 1) return await dashboard(request);
    if (method === "POST" && path[0] === "profile" && path.length === 1) return await profile(request);
    if (method === "POST" && path[0] === "quizzes" && path.length === 1) return await saveQuiz(request);
    if (method === "DELETE" && path[0] === "quizzes" && path.length === 2) return await deleteQuiz(request, path[1]);
    if (method === "POST" && path[0] === "rooms" && path.length === 1) return await createRoom(request);
    if (path[0] === "rooms" && path.length >= 2) {
      if (method === "GET" && path.length === 2) return await roomState(request, path[1]);
      if (method === "POST" && path.length === 3) {
        if (path[2] === "join") return await joinRoom(request, path[1]);
        if (path[2] === "answer") return await answer(request, path[1]);
        if (path[2] === "control") return await controlRoom(request, path[1]);
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
