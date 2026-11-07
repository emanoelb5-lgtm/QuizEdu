import {LessonCatalog} from "@/app/ui/lesson-catalog";
import {READY_LESSONS} from "@/lib/lesson-catalog";
import {accountSignInPath} from "../account-auth";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const query=await searchParams;
  return <LessonCatalog initialSubject={typeof query.disciplina==="string"?query.disciplina:""} signInTargets={Object.fromEntries(READY_LESSONS.map(lesson=>[lesson.id,accountSignInPath(`/aulas-prontas?usar=${lesson.id}&vincular=1`)]))}/>;
}
