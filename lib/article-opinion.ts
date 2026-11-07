import imported from "./ready-lessons/artigo-opiniao.json";
import {duplicateDeck,type SlideDeck} from "./presentation";

export const ARTICLE_SUPPORT_TEXT={
  title:"Celular na escola: proibir ou ensinar a usar?",
  credit:"Texto didático elaborado para esta aula, a partir do tema e das ideias da apresentação.",
  paragraphs:[
    "O celular faz parte da rotina de muitos adolescentes. Na escola, mensagens, jogos e vídeos sem relação com a atividade podem tirar o foco da aula. Regras claras são necessárias.",
    "Defendo o uso do celular com critérios e finalidade pedagógica. O celular pode ter sentido pedagógico com orientação. Seu uso precisa respeitar as regras da escola e o planejamento do professor.",
    "Uma pesquisa em fontes indicadas, o registro de uma observação e a participação em um quiz são exemplos de usos que podem ajudar a turma. O professor apresenta a tarefa e acompanha sua realização.",
    "Por outro lado, usar o aparelho para conversar sobre outros assuntos ou assistir a vídeos durante uma explicação pode interromper a concentração. O problema não está só no aparelho, mas no modo de uso.",
    "Também é necessário incluir quem não tem celular. A atividade pode oferecer participação em duplas ou outros recursos. A oportunidade de aprender deve ser para todos.",
    "A tecnologia deve servir à aprendizagem. Regras claras, orientação e objetivos definidos podem transformar o celular em um recurso da aula, com espaço para a participação responsável de toda a turma."
  ]
};
export function articleOpinionLesson():SlideDeck{
  const deck=duplicateDeck(imported as SlideDeck);
  return {...deck,title:"Artigo de opinião · Aula 1 · 9º ano"};
}
