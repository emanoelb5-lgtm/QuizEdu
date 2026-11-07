import {HttpError,json} from "./server";
import {filterReadyLessons,LESSON_SUBJECTS,LESSON_GRADES} from "./lesson-catalog";
import {readyLesson} from "./ready-lessons";

export function readLessonCatalog(request:Request){
  const query=new URL(request.url).searchParams;
  return json({version:1,subjects:LESSON_SUBJECTS,grades:LESSON_GRADES,lessons:filterReadyLessons({subject:query.get("subject")||"",grade:query.get("grade")||"",query:query.get("q")||""})});
}
export function readReadyLesson(id:string){
  const content=readyLesson(id);if(!content)throw new HttpError(404,"Esta aula pronta não foi encontrada.");
  return json(content);
}
