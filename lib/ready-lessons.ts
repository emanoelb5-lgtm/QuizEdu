import {sampleDeck,type SlideDeck} from "./presentation";
import {contosExample} from "./contos-example";
import {articleOpinionLesson,ARTICLE_SUPPORT_TEXT} from "./article-opinion";
import {lessonMetadata} from "./lesson-catalog";

export function readyLesson(id:string){
  const lesson=lessonMetadata(id);if(!lesson)return undefined;
  let presentation:SlideDeck;
  if(id==="artigo-opiniao-9-ano-aula-1")presentation=articleOpinionLesson();
  else if(id==="contos-7-ano-dia-5")presentation=contosExample().presentation;
  else if(id==="solo-vivo-turma-em-acao")presentation=sampleDeck();
  else return undefined;
  return {lesson,presentation,...(lesson.hasSupportText?{supportText:ARTICLE_SUPPORT_TEXT}:{})};
}
