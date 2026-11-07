import {notFound} from "next/navigation";
import {readyLesson} from "@/lib/ready-lessons";
import {LessonSupportText} from "@/app/ui/lesson-support-text";
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params,content=readyLesson(id);
  if(!content?.supportText)notFound();
  return <LessonSupportText text={content.supportText} lessonTitle={content.lesson.title} grade={content.lesson.gradeLabel}/>;
}
