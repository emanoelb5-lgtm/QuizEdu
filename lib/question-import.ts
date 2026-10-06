import {DURATIONS, LETTERS, newQuestion, Question, QuestionKind, questionIssues} from "./quiz";

export type ImportItem={question:Question;source:string;notes:string[];fatal:string[]};
export type QuestionImport={items:ImportItem[];notes:string[]};
export const IMPORT_EXAMPLE=`1. Qual prática ajuda a proteger o solo da erosão?
A) Manter a cobertura vegetal
B) Queimar a área
C) Deixar o solo descoberto
Resposta: A
Tempo: 30
Explicação: A cobertura reduz o impacto da chuva sobre o solo.

2. As abelhas contribuem para a polinização.
Resposta: Verdadeiro
Explicação: Ao visitar flores, elas transportam pólen.`;
export const IMPORT_CSV="\uFEFFPergunta;A;B;C;D;Correta;Tempo;Explicação;Modelo\r\nQual prática protege o solo?;Manter a cobertura vegetal;Queimar a área;Deixar o solo descoberto;;A;30;A cobertura reduz o impacto da chuva.;Múltipla escolha\r\nAs abelhas contribuem para a polinização.;Verdadeiro;Falso;;;A;30;Elas transportam pólen entre flores.;Verdadeiro ou falso\r\n";
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
const compact=(s:string)=>normalize(s).replace(/[^a-z0-9]/g,"");
const truth=(s:string)=>["verdadeiro","v","true","certo"].includes(normalize(s))?0:["falso","f","false","errado"].includes(normalize(s))?1:null;

function answerIndex(value:string,options:string[]):number {
  const text=value.trim().replace(/^[([]|[)\].]$/g,"").trim();
  if(/^[a-h]$/i.test(text)){const i=text.toUpperCase().charCodeAt(0)-65;return i<options.length?i:-1;}
  if(/^[1-8]$/.test(text)){const i=Number(text)-1;return i<options.length?i:-1;}
  const matches=options.map((o,i)=>normalize(o)===normalize(text)&&o.trim()?i:-1).filter(i=>i>=0);
  return matches.length===1?matches[0]:-1;
}
function kindFrom(value:string):QuestionKind|undefined {
  const s=compact(value);if(["vf","verdadeirooufalso","truefalse"].includes(s))return "true_false";
  if(["imagem","identificarumaimagem","image"].includes(s))return "image";
  if(["situacaopratica","situacao","scenario"].includes(s))return "scenario";
  if(["multiplaescolha","multiple","quiz"].includes(s))return "multiple";
}
function item(question:Question,source:string,notes:string[]=[]):ImportItem {
  const fatal:string[]=[];
  if(question.text.length>400)fatal.push("O enunciado ultrapassa 400 caracteres.");
  if(question.explanation.length>500)fatal.push("A explicação ultrapassa 500 caracteres.");
  if(question.options.length>4)fatal.push("O QuizEdu aceita até quatro alternativas.");
  if(question.kind==="true_false"&&(question.options.length!==2||question.options[0]!=="Verdadeiro"||question.options[1]!=="Falso"))fatal.push("No modelo Verdadeiro ou falso, use essas duas alternativas nesta ordem. Corrija a planilha antes de adicionar.");
  question.options.forEach((o,i)=>{if(o.length>180)fatal.push(`A alternativa ${LETTERS[i]||i+1} ultrapassa 180 caracteres.`);});
  return {question,source,notes,fatal};
}
function duration(value:string,fallback:number,notes:string[]):number {
  if(!value.trim())return fallback;
  const seconds=Number(value.trim().replace(/\s*(?:s|segundos?)\s*$/i,""));
  if(DURATIONS.includes(seconds))return seconds;
  notes.push(`O tempo “${value}” não está disponível. Foi usado ${fallback} segundos; você pode alterá-lo no editor.`);return fallback;
}
function resolveAnswer(q:Question,values:string[],notes:string[]){
  if(!values.length)return;
  const indices=values.map(v=>answerIndex(v,q.options));
  if(indices.every(i=>i>=0)&&new Set(indices).size===1)q.correct=indices[0];
  else {q.correct=-1;notes.push("O gabarito está ausente, não corresponde às alternativas ou tem mais de uma resposta. Marque a correta no editor.");}
}

/** Parse a teacher's pasted question list; incomplete answers remain drafts. */
export function parseQuestionText(input:string,defaultSeconds=30):QuestionImport {
  if(input.length>524288)throw new Error("Cole um texto de até 512 KB.");
  const result:QuestionImport={items:[],notes:[]};
  type Block={lines:string[];options:Map<number,string>;answers:string[];explanation:string[];seconds:string;source:string;number?:number;notes:string[];fatal:string[]};
  let block:Block|null=null;let blank=false;let explanation=false;
  const key=new Map<number,string>();
  function start(line:number,number?:number){block={lines:[],options:new Map(),answers:[],explanation:[],seconds:"",source:number?`Pergunta ${number}`:`Linha ${line}`,number,notes:[],fatal:[]};explanation=false;}
  const numberedItems:{number?:number;item:ImportItem}[]=[];
  function finish(){
    if(!block)return;const b=block;block=null;if(!b.lines.length&&!b.options.size)return;
    if(result.items.length>=100)throw new Error("Importe até 100 perguntas por vez e escolha até 50 para o quiz.");
    const q=newQuestion("multiple",{seconds:defaultSeconds});q.text=b.lines.join("\n").trim();q.explanation=b.explanation.join("\n").trim();
    if(b.options.size){const last=Math.max(...b.options.keys());q.options=Array.from({length:Math.max(2,last+1)},(_,i)=>b.options.get(i)||"");}
    else if(b.answers.length&&b.answers.every(v=>truth(v)!==null)){q.kind="true_false";q.options=["Verdadeiro","Falso"];b.answers=b.answers.map(v=>LETTERS[truth(v)!]);}
    if(q.options.length===2&&q.options[0]==="Verdadeiro"&&q.options[1]==="Falso")q.kind="true_false";
    q.seconds=duration(b.seconds,q.seconds,b.notes);resolveAnswer(q,b.answers,b.notes);
    const parsed=item(q,b.source,b.notes);parsed.fatal.push(...b.fatal);result.items.push(parsed);numberedItems.push({number:b.number,item:parsed});
  }
  const lines=input.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n").split("\n");
  lines.forEach((raw,index)=>{
    const line=raw.trim();if(!line){blank=true;return;}
    const label=line.match(/^(gabarito|resposta(?:\s+correta)?|correta|answer)\s*:\s*(.*)$/i);
    if(label){
      const pairs=[...label[2].matchAll(/(?:^|[,;\s])([0-9]{1,3})\s*[-:.)]\s*([A-D])(?=$|[,;\s])/gi)];
      if(pairs.length){pairs.forEach(p=>{const n=Number(p[1]);if(key.has(n)&&key.get(n)!==p[2].toUpperCase())throw new Error(`Há dois gabaritos diferentes para a pergunta ${n}.`);key.set(n,p[2].toUpperCase());});}
      else {if(!block)start(index+1);block!.answers.push(label[2]);}
      blank=false;explanation=false;return;
    }
    const meta=line.match(/^(tempo|time|explica[cç][aã]o|justificativa|coment[aá]rio)\s*:\s*(.*)$/i);
    if(meta){if(!block)start(index+1);if(/^(tempo|time)$/i.test(meta[1])){block!.seconds=meta[2];explanation=false;}else{block!.explanation.push(meta[2]);explanation=true;}blank=false;return;}
    if(!block&&/^(t[ií]tulo|disciplina|assunto|turma|atividade)\s*:/i.test(line)){result.notes.push(`Cabeçalho preservado no texto de origem: ${line}`);return;}
    const option=line.match(/^([*✓]?)\s*([A-H])\s*[).:\-]\s*(.+)$/i);
    if(option){if(!block)start(index+1);const at=option[2].toUpperCase().charCodeAt(0)-65;const marked=!!option[1]||/\s*\[(?:correta|correct)\]\s*$/i.test(option[3]);const text=option[3].replace(/\s*\[(?:correta|correct)\]\s*$/i,"").trim();if(block!.options.has(at))block!.fatal.push(`A alternativa ${option[2].toUpperCase()} aparece mais de uma vez. Corrija o texto antes de adicionar.`);else block!.options.set(at,text);if(marked)block!.answers.push(option[2]);blank=false;explanation=false;return;}
    const numbered=line.match(/^(?:pergunta\s+)?(\d{1,3})\s*[).:\-]\s*(.+)$/i);
    if(numbered){finish();start(index+1,Number(numbered[1]));block!.lines.push(numbered[2]);}
    else if((block?.options.size||block?.answers.length)&&blank){finish();start(index+1);block!.lines.push(line);}
    else {if(!block)start(index+1);if(explanation)block!.explanation.push(line);else if(block!.options.size){const last=Math.max(...block!.options.keys());block!.options.set(last,block!.options.get(last)+"\n"+line);}else block!.lines.push(line);}
    blank=false;
  });finish();
  for(const [number,value] of key){const matches=numberedItems.filter(x=>x.number===number);if(matches.length!==1)throw new Error(`O gabarito da pergunta ${number} não tem um enunciado com numeração única.`);const row=matches[0].item;const previous=row.question.correct;const parsed=answerIndex(value,row.question.options);if(previous>=0&&parsed!==previous){row.question.correct=-1;row.notes.push("Há gabaritos diferentes para esta pergunta. Confirme a correta no editor.");}else row.question.correct=parsed;}
  return result;
}

function parseDelimited(input:string):string[][] {
  const text=input.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n");const first=text.split("\n").find(line=>line.trim())||"";
  let quoted=false;const counts=new Map([[";",0],[",",0],["\t",0]]);
  for(let i=0;i<first.length;i++){if(first[i]==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&counts.has(first[i]))counts.set(first[i],counts.get(first[i])!+1);}
  const delimiter=[...counts].sort((a,b)=>b[1]-a[1])[0][0];const rows:string[][]=[];let row:string[]=[];let cell="";let inQuotes=false;let closed=false;
  function pushRow(){row.push(cell);if(row.some(s=>s.trim()))rows.push(row);row=[];cell="";closed=false;if(rows.length>101)throw new Error("A planilha deve ter até 100 perguntas, além do cabeçalho.");}
  for(let i=0;i<text.length;i++){const c=text[i];if(inQuotes){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else {inQuotes=false;closed=true;}}else cell+=c;}
    else if(c===delimiter){row.push(cell);cell="";closed=false;}
    else if(c==="\n")pushRow();
    else if(c==='"'&&!cell.trim()&&!closed){cell="";inQuotes=true;}
    else if(closed&&!/\s/.test(c))throw new Error("Há texto fora das aspas em uma célula. Confira o CSV.");
    else if(!closed)cell+=c;
  }
  if(inQuotes)throw new Error("O CSV tem aspas abertas. Corrija a célula antes de importar.");if(cell||row.length)pushRow();return rows;
}
export function parseQuestionCsv(input:string,defaultSeconds=30):QuestionImport {if(input.length>524288)throw new Error("Use um CSV de até 512 KB.");return parseQuestionRows(parseDelimited(input),defaultSeconds);}

export function parseQuestionRows(rows:unknown[][],defaultSeconds=30):QuestionImport {
  const result:QuestionImport={items:[],notes:[]};const cell=(v:unknown)=>v===null||v===undefined?"":v instanceof Date?v.toISOString():String(v);
  const meaningful=rows.filter(row=>row.some(v=>cell(v).trim()));if(!meaningful.length)return result;
  if(meaningful.length>101)throw new Error("A planilha deve ter até 100 perguntas, além do cabeçalho.");
  const headers=meaningful[0].map(v=>compact(cell(v)));const columns=new Map<string,number>();
  headers.forEach((s,i)=>{
    let field="";if(["pergunta","enunciado","afirmacao","situacao"].includes(s)||s.startsWith("question"))field="text";
    else if(["correta","respostacorreta","gabarito","resposta","correct"].includes(s)||s.startsWith("correctanswer"))field="correct";
    else if(["tempo","segundos","tempos","time"].includes(s)||s.startsWith("timelimit"))field="seconds";
    else if(["explicacao","justificativa","comentario","explanation"].includes(s))field="explanation";
    else if(["modelo","tipo","kind"].includes(s))field="kind";
    else {const letter=s.match(/^(?:alternativa|opcao|resposta|option)?([a-d])$/);const number=s.match(/^answer([1-4])/);if(letter)field=letter[1].toUpperCase();else if(number)field=LETTERS[Number(number[1])-1];}
    if(field){if(columns.has(field))throw new Error(`A coluna “${cell(meaningful[0][i])}” está repetida.`);columns.set(field,i);}
  });
  if(!columns.has("text"))throw new Error("A primeira linha precisa ter a coluna Pergunta ou Enunciado. Baixe o modelo de planilha para conferir.");
  if(!columns.has("correct"))result.notes.push("Não há coluna Correta. As perguntas serão rascunhos até você marcar o gabarito.");
  meaningful.slice(1).forEach((row,i)=>{
    const read=(field:string)=>cell(row[columns.get(field)??-1]).trim();const notes:string[]=[];const rawKind=read("kind");const suppliedKind=kindFrom(rawKind);if(rawKind&&!suppliedKind)notes.push(`O modelo “${rawKind}” não foi reconhecido. Confira a pergunta no editor.`);
    const rawAnswer=read("correct");const options=LETTERS.map(l=>read(l));while(options.length>2&&!options[options.length-1])options.pop();
    let kind=suppliedKind||"multiple";
    if(options.every(o=>!o)&&(suppliedKind==="true_false"||truth(rawAnswer)!==null)){kind="true_false";options.splice(0,options.length,"Verdadeiro","Falso");}
    if(options.length===2&&options[0]==="Verdadeiro"&&options[1]==="Falso")kind="true_false";
    const q=newQuestion(kind,{seconds:defaultSeconds});q.text=read("text");q.options=options;q.explanation=read("explanation");q.seconds=duration(read("seconds"),q.seconds,notes);
    const resolved=q.kind==="true_false"&&truth(rawAnswer)!==null?LETTERS[truth(rawAnswer)!]:rawAnswer;resolveAnswer(q,[resolved].filter(Boolean),notes);
    result.items.push(item(q,`Linha ${i+2}`,notes));
  });return result;
}

export function importNeedsReview(row:ImportItem):boolean {return !!row.fatal.length||questionIssues(row.question).some(issue=>issue.severity==="error");}
