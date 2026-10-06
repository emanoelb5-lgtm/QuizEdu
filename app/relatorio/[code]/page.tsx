import { LessonReportView } from "@/app/ui/lesson-report";
export default async function ReportPage({params}:{params:Promise<{code:string}>}){const {code}=await params;return <LessonReportView code={code}/>;}
