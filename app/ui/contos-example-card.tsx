"use client";
import {BookOpen, ArrowUpRight} from "lucide-react";
import {CONTOS_EXAMPLE} from "@/lib/example-catalog";

export function ContosExampleCard({busy,onUse,format="quiz",headingLevel=2}:{busy:boolean;onUse:()=>void;format?:"quiz"|"presentation";headingLevel?:2|3}) {
  const Heading=headingLevel===3?"h3":"h2";
  return <article className="contos-example-card" aria-label="Atividade de exemplo de Português">
    <div className="contos-example-art" aria-hidden="true"><BookOpen size={38} strokeWidth={1.5}/><span>5º DIA</span></div>
    <div className="contos-example-body"><span className="contos-example-label">PORTUGUÊS · {CONTOS_EXAMPLE.year}</span><Heading>{CONTOS_EXAMPLE.title}</Heading><p>“A cartomante” e “O Boi Velho”: leitura, narrativa e variação linguística.</p><span className="contos-example-meta">{CONTOS_EXAMPLE.questionCount} perguntas · Gabarito comentado · Sem cronômetro</span></div>
    <button className="btn btn-outline" disabled={busy} onClick={onUse}>{format==="presentation"?"Usar apresentação":"Usar atividade"}<ArrowUpRight size={17}/></button>
  </article>;
}
