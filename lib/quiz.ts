export const AVATARS = ["🦊", "🐼", "🐸", "🦁", "🐯", "🐨", "🐧", "🦉", "🐝", "🦋", "🐢", "🐙"];
export const LETTERS = ["A", "B", "C", "D"];
export const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];
export type QuestionKind = "multiple" | "true_false" | "image" | "scenario";
export type Question = { id: string; text: string; options: string[]; correct: number; seconds: number; explanation: string; image?: string; imageAlt?: string; optionImages?: string[]; kind?: QuestionKind };
export const QUESTION_TEMPLATES: {kind:QuestionKind;label:string;description:string;placeholder:string}[] = [
  {kind:"multiple",label:"Múltipla escolha",description:"Uma pergunta com duas a quatro alternativas.",placeholder:"Escreva uma pergunta clara para sua turma…"},
  {kind:"true_false",label:"Verdadeiro ou falso",description:"Uma afirmação com duas respostas prontas.",placeholder:"Escreva uma afirmação que a turma vai avaliar…"},
  {kind:"image",label:"Identificar uma imagem",description:"Uma foto para observar e escolher a resposta.",placeholder:"O que a turma deve identificar ou observar nesta imagem?"},
  {kind:"scenario",label:"Situação prática",description:"Um caso do cotidiano para decidir como agir.",placeholder:"Descreva uma situação e pergunte qual decisão a turma tomaria…"}
];
export type GameMode = "speed" | "accuracy";
export type Quiz = { id: string; title: string; questions: Question[]; updatedAt?: number; mode?: GameMode; untimed?: boolean; subject?: string; topic?: string };
export type Profile = { id: string; name: string; permanent: boolean };
export type Draft = { id: string; quiz: Quiz; updatedAt: number; revision: number; writeId?: string };
export type BankQuestion = { id: string; question: Question; subject: string; topic: string; updatedAt: number };
export type Player = { id: string; name: string; avatar: string; score: number; correctCount: number; totalMs: number; position: number; answered: boolean; roundPoints: number; roundCorrect: boolean | null; lastSeen?: number };
export type RoomState = {
  code: string; title: string; teacher: string; status: "lobby" | "slide" | "question" | "results" | "finished" | "closed";
  index: number; total: number; startsAt: number | null; endsAt: number | null; serverNow: number; revision?: number; clock?: import("./live-clock").LiveClock;
  question: Omit<Question, "correct" | "explanation"> | null; correct: number | null; explanation: string | null;
  players: Player[]; answeredCount: number; isHost: boolean; me: (Player & { option: number | null }) | null; expiresAt: number; version: string;
  mode: GameMode; untimed: boolean; presence?: Record<string, number>;
  presentation?: import("./presentation").RoomPresentation;
};
export type ReportPlayer = { id: string; name: string; avatar: string; score: number; correctCount: number; answeredCount: number; position: number; answers: ({ option: number; correct: boolean; points: number; elapsedMs: number } | null)[] };
export type LessonReport = { code: string; title: string; teacher: string; createdAt: number; status: string; mode: GameMode; untimed: boolean; total: number; completed: number; accuracy: number; players: ReportPlayer[]; questions: { question: Question; answered: number; correct: number; accuracy: number; choices: number[] }[] };
export function newQuestion(kind:QuestionKind="multiple",settings:{seconds?:number;optionCount?:number}={}): Question {
  const count=settings.optionCount&&settings.optionCount>=2&&settings.optionCount<=4?settings.optionCount:4;
  return {id:crypto.randomUUID(),kind,text:"",options:kind==="true_false"?["Verdadeiro","Falso"]:Array(count).fill(""),correct:-1,seconds:DURATIONS.includes(settings.seconds||0)?settings.seconds!:30,explanation:""};
}
export function applyQuestionTemplate(question:Question,kind:QuestionKind):Question {
  if(kind==="true_false"&&question.kind!=="true_false")return {...question,kind,options:["Verdadeiro","Falso"],correct:-1,optionImages:undefined};
  if(question.kind==="true_false"&&kind!=="true_false")return {...question,kind,options:["","","",""],correct:-1,optionImages:undefined};
  return {...question,kind};
}
export function emptyQuestion(question:Question):boolean {return !question.text.trim()&&!question.image&&!question.explanation.trim()&&(!question.optionImages||question.optionImages.every(v=>!v))&&((question.kind==="true_false"&&question.correct===-1)||question.options.every(o=>!o.trim()));}
export type QuestionIssue={field:"text"|"options"|"correct"|"seconds"|"explanation"|"image"|"imageAlt"|"kind";message:string;severity:"error"|"warning";option?:number};
export function questionIssues(q:Question):QuestionIssue[] {
  const issues:QuestionIssue[]=[];const error=(field:QuestionIssue["field"],message:string,option?:number)=>issues.push({field,message,severity:"error",...(option!==undefined?{option}:{})});
  const warning=(field:QuestionIssue["field"],message:string,option?:number)=>issues.push({field,message,severity:"warning",...(option!==undefined?{option}:{})});
  if(!q||typeof q.text!=="string"||typeof q.explanation!=="string"||!Array.isArray(q.options)){error("text","Verifique o formato da pergunta.");return issues;}
  if(!q.text.trim())error("text","Escreva o enunciado.");else if(q.text.length>400)error("text","Use até 400 caracteres no enunciado.");else if(q.text.length>240)warning("text","O enunciado está longo. Confira a leitura no celular.");
  if(q.options.length<2||q.options.length>4)error("options","Use de duas a quatro alternativas.");
  const seen=new Map<string,number>();
  q.options.forEach((o,i)=>{if(typeof o!=="string"||!o.trim())error("options",`Preencha a alternativa ${LETTERS[i]||i+1}.`,i);else if(o.length>180)error("options",`Use até 180 caracteres na alternativa ${LETTERS[i]}.`,i);else{const value=o.trim().replace(/\s+/g," ").normalize("NFC").toLocaleLowerCase("pt-BR");const previous=seen.get(value);if(previous!==undefined)error("options",`As alternativas ${LETTERS[previous]} e ${LETTERS[i]} são iguais.`,i);else seen.set(value,i);if(o.length>100)warning("options",`A alternativa ${LETTERS[i]} está longa. Teste no celular.`,i);}});
  if(!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.options.length)error("correct","Marque a resposta correta.");
  if(!DURATIONS.includes(q.seconds))error("seconds","Escolha um tempo disponível.");
  if(q.explanation.length>500)error("explanation","Use até 500 caracteres na explicação.");
  if(q.kind!==undefined&&!QUESTION_TEMPLATES.some(t=>t.kind===q.kind))error("kind","Escolha um modelo válido.");
  if(q.kind==="true_false"&&(q.options.length!==2||q.options[0]!=="Verdadeiro"||q.options[1]!=="Falso"))error("options","Use as alternativas Verdadeiro e Falso neste modelo.");
  if(q.kind==="image"&&!q.image)error("image","Adicione a imagem que a turma vai observar.");
  if(q.image&&!mediaPath(q.image))error("image","Selecione uma imagem enviada pelo QuizEdu.");
  if(q.imageAlt!==undefined&&(typeof q.imageAlt!=="string"||q.imageAlt.length>180))error("imageAlt","Use até 180 caracteres na descrição da imagem.");
  else if(q.image&&(!q.imageAlt?.trim()||q.imageAlt.trim()==="Imagem da pergunta"))warning("imageAlt","Descreva o que aparece na imagem para ajudar quem não consegue vê-la.");
  if(q.optionImages&&(!Array.isArray(q.optionImages)||q.optionImages.length!==q.options.length||q.optionImages.some(v=>typeof v!=="string"||(v&&!mediaPath(v)))))error("image","Verifique as imagens das alternativas.");
  return issues;
}
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
  if (quiz.untimed !== undefined && typeof quiz.untimed !== "boolean") return "Escolha uma configuração de tempo válida.";
  if ([quiz.subject,quiz.topic].some(v=>v!==undefined&&(typeof v!=="string"||v.length>60))) return "Use até 60 caracteres para disciplina e assunto.";
  if (quiz.untimed && quiz.mode !== "accuracy") return "O tempo livre está disponível no modo aprendizagem.";
  if (!quiz.title.trim() || quiz.title.trim().length > 100) return "Dê um título ao quiz (até 100 caracteres).";
  if (!quiz.questions.length || quiz.questions.length > 50) return "O quiz deve ter de 1 a 50 perguntas.";
  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i]; const label = `Pergunta ${i + 1}: `;
    const issue=questionIssues(q).find(issue=>issue.severity==="error");if(issue)return label+issue.message;
  }
  return null;
}
export function mediaPath(value: unknown): value is string { return typeof value === "string" && /^\/api\/media\/[a-f0-9-]{36}$/.test(value); }
export const MAX_POINTS = 1000;
export function scoreFor(correct: boolean, elapsedMs: number, durationMs: number, firstCorrect = false) {
  if (!correct) return 0;
  if (firstCorrect) return MAX_POINTS;
  const timedPoints = 500 + Math.floor(500 * (1 - Math.max(0, Math.min(1, elapsedMs / durationMs))));
  return timedPoints - MAX_POINTS * 0.3;
}
export function points(n: number) { return new Intl.NumberFormat("pt-BR").format(n); }
