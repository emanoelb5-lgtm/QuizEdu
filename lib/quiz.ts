export const AVATARS = ["🦊", "🐼", "🐸", "🦁", "🐯", "🐨", "🐧", "🦉", "🐝", "🦋", "🐢", "🐙"];
export const LETTERS = ["A", "B", "C", "D"];
export const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];
export type Question = { id: string; text: string; options: string[]; correct: number; seconds: number; explanation: string; image?: string; imageAlt?: string; optionImages?: string[] };
export type GameMode = "speed" | "accuracy";
export type Quiz = { id: string; title: string; questions: Question[]; updatedAt?: number; mode?: GameMode; untimed?: boolean; subject?: string; topic?: string };
export type Profile = { id: string; name: string; permanent: boolean };
export type Draft = { id: string; quiz: Quiz; updatedAt: number; revision: number; writeId?: string };
export type BankQuestion = { id: string; question: Question; subject: string; topic: string; updatedAt: number };
export type Player = { id: string; name: string; avatar: string; score: number; correctCount: number; totalMs: number; position: number; answered: boolean; roundPoints: number; roundCorrect: boolean | null; lastSeen?: number };
export type RoomState = {
  code: string; title: string; teacher: string; status: "lobby" | "question" | "results" | "finished" | "closed";
  index: number; total: number; startsAt: number | null; endsAt: number | null; serverNow: number;
  question: Omit<Question, "correct" | "explanation"> | null; correct: number | null; explanation: string | null;
  players: Player[]; answeredCount: number; isHost: boolean; me: (Player & { option: number | null }) | null; expiresAt: number; version: string;
  mode: GameMode; untimed: boolean; presence?: Record<string, number>;
};
export type ReportPlayer = { id: string; name: string; avatar: string; score: number; correctCount: number; answeredCount: number; position: number; answers: ({ option: number; correct: boolean; points: number; elapsedMs: number } | null)[] };
export type LessonReport = { code: string; title: string; teacher: string; createdAt: number; status: string; mode: GameMode; untimed: boolean; total: number; completed: number; accuracy: number; players: ReportPlayer[]; questions: { question: Question; answered: number; correct: number; accuracy: number; choices: number[] }[] };
export function newQuestion(): Question { return { id: crypto.randomUUID(), text: "", options: ["", "", "", ""], correct: 0, seconds: 30, explanation: "" }; }
export function newQuiz(): Quiz { return { id: crypto.randomUUID(), title: "Meu novo quiz", questions: [newQuestion()] }; }
export function sampleQuiz(): Quiz {
  return { id: crypto.randomUUID(), title: "Brasil e natureza", questions: [
    { text: "Qual é o maior bioma brasileiro em área?", options: ["Cerrado", "Amazônia", "Caatinga", "Mata Atlântica"], correct: 1, explanation: "A Amazônia ocupa a maior área entre os biomas brasileiros.", seconds: 30 },
    { text: "Qual prática ajuda a proteger o solo da erosão?", options: ["Deixar o solo descoberto", "Queimar a vegetação", "Manter a cobertura vegetal", "Retirar a matéria orgânica"], correct: 2, explanation: "A cobertura vegetal reduz o impacto da chuva e ajuda a manter o solo no lugar.", seconds: 30 },
    { text: "Na fotossíntese, as plantas utilizam principalmente qual fonte de energia?", options: ["Luz solar", "Vento", "Som", "Calor do solo"], correct: 0, explanation: "As plantas usam a energia da luz para produzir compostos orgânicos.", seconds: 20 },
    { text: "Qual destes animais é um importante polinizador?", options: ["Minhoca", "Abelha", "Peixe", "Sapo"], correct: 1, explanation: "As abelhas transportam pólen entre flores e contribuem para a reprodução de muitas plantas.", seconds: 20 },
    { text: "Qual é a capital do estado do Pará?", options: ["Manaus", "São Luís", "Macapá", "Belém"], correct: 3, explanation: "Belém é a capital do Pará.", seconds: 20 }
  ].map(q => ({ ...q, id: crypto.randomUUID() })) };
}
export function quizError(quiz: Quiz): string | null {
  if (!quiz || typeof quiz.title !== "string" || !Array.isArray(quiz.questions)) return "O quiz está em um formato inválido.";
  if (quiz.mode !== undefined && !["speed", "accuracy"].includes(quiz.mode)) return "Escolha um modo de jogo válido.";
  if (quiz.untimed && quiz.mode !== "accuracy") return "O tempo livre está disponível no modo aprendizagem.";
  if (!quiz.title.trim() || quiz.title.trim().length > 100) return "Dê um título ao quiz (até 100 caracteres).";
  if (!quiz.questions.length || quiz.questions.length > 50) return "O quiz deve ter de 1 a 50 perguntas.";
  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i]; const label = `Pergunta ${i + 1}: `;
    if (!q || typeof q.text !== "string" || !Array.isArray(q.options) || typeof q.explanation !== "string") return label + "verifique o formato da pergunta.";
    if (!q.text.trim() || q.text.length > 400) return label + "escreva o enunciado (até 400 caracteres).";
    if (q.options.length < 2 || q.options.length > 4 || q.options.some(o => !o.trim() || o.length > 180)) return label + "preencha todas as alternativas (até 180 caracteres cada).";
    if (new Set(q.options.map(o => o.trim().toLocaleLowerCase())).size !== q.options.length) return label + "as alternativas precisam ser diferentes.";
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) return label + "marque a resposta correta.";
    if (!DURATIONS.includes(q.seconds)) return label + "escolha um tempo válido.";
    if (q.explanation.length > 500) return label + "a explicação pode ter até 500 caracteres.";
    if (q.image && !mediaPath(q.image)) return label + "selecione uma imagem enviada pelo QuizEdu.";
    if (q.imageAlt && (typeof q.imageAlt !== "string" || q.imageAlt.length > 180)) return label + "a descrição da imagem pode ter até 180 caracteres.";
    if (q.optionImages && (!Array.isArray(q.optionImages) || q.optionImages.length !== q.options.length || q.optionImages.some(v => typeof v !== "string" || (v && !mediaPath(v))))) return label + "verifique as imagens das alternativas.";
  }
  return null;
}
export function mediaPath(value: unknown): value is string { return typeof value === "string" && /^\/api\/media\/[a-f0-9-]{36}$/.test(value); }
export function scoreFor(correct: boolean, elapsedMs: number, durationMs: number) {
  return correct ? 500 + Math.floor(500 * (1 - Math.max(0, Math.min(1, elapsedMs / durationMs)))) : 0;
}
export function points(n: number) { return new Intl.NumberFormat("pt-BR").format(n); }
