export type ReadyLesson = {
  id:string; title:string; subjectId:string; subject:string; grade:string; gradeLabel:string;
  unit:string; description:string; objectives:string[]; tags:string[]; thumbnail:string|null;
  slideCount:number; questionCount:number; pollCount?:number; cloudCount:number; hasSupportText:boolean;
};
export const READY_LESSONS:ReadyLesson[]=[
  {id:"artigo-opiniao-9-ano-aula-1",title:"Artigo de opinião",subjectId:"portugues",subject:"Português",grade:"9",gradeLabel:"9º ano",unit:"Aula 1 · 4º bimestre",description:"Características do gênero, leitura com letras maiores, três enquetes de preferência e avaliação da aula.",objectives:["Reconhecer o gênero artigo de opinião.","Distinguir informação, opinião, tema e questão controversa.","Identificar tese e argumentos em um texto."],tags:["artigo de opinião","argumentação","notícia","reportagem","tese","celular","4º bimestre","enquetes","açaí","Nescau","Toddy","livro","filme","avaliação"],thumbnail:"/lessons/artigo-opiniao/ilustracao-1.jpg",slideCount:36,questionCount:7,pollCount:4,cloudCount:1,hasSupportText:true},
  {id:"contos-7-ano-dia-5",title:"Contos em diálogo",subjectId:"portugues",subject:"Português",grade:"7",gradeLabel:"7º ano",unit:"Revisão · 5º dia",description:"A cartomante e O Boi Velho: interpretação, elementos da narrativa e variação linguística.",objectives:["Revisar os dois contos e os elementos da narrativa.","Justificar interpretações com pistas dos textos.","Reconhecer a diversidade linguística sem preconceito."],tags:["conto","Machado de Assis","Simões Lopes Neto","narrativa","variação linguística"],thumbnail:null,slideCount:19,questionCount:16,cloudCount:0,hasSupportText:false},
  {id:"solo-vivo-turma-em-acao",title:"Solo vivo, turma em ação",subjectId:"agroecologia",subject:"Agroecologia",grade:"livre",gradeLabel:"Uso livre",unit:"Conservação do solo",description:"Fotografias e situações do campo para discutir erosão, cobertura vegetal e cuidado com o solo.",objectives:["Reconhecer sinais de erosão.","Relacionar cobertura vegetal e conservação do solo.","Escolher práticas de cuidado com o solo."],tags:["solo","erosão","palhada","cobertura vegetal","agricultura","agrárias"],thumbnail:"/examples/plantio.jpg",slideCount:14,questionCount:6,cloudCount:0,hasSupportText:false}
];
export const LESSON_SUBJECTS=[{id:"portugues",name:"Português"},{id:"agroecologia",name:"Agroecologia"}];
export const LESSON_GRADES=[{id:"7",name:"7º ano"},{id:"9",name:"9º ano"},{id:"livre",name:"Uso livre"}];
export function lessonMetadata(id:string){return READY_LESSONS.find(lesson=>lesson.id===id);}
export function filterReadyLessons({subject="",grade="",query=""}:{subject?:string;grade?:string;query?:string}={}){
  const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
  const terms=normalize(query.slice(0,120)).trim().split(/\s+/).filter(Boolean);
  return READY_LESSONS.filter(lesson=>(!subject||lesson.subjectId===subject)&&(!grade||lesson.grade===grade)&&terms.every(term=>normalize([lesson.title,lesson.description,lesson.subject,lesson.gradeLabel,lesson.unit,...lesson.tags].join(" ")).includes(term)));
}
