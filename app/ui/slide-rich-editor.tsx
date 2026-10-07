"use client";
import {useState} from "react";
import {EditorContent} from "@tiptap/react";
import {Check,Eye,EyeOff} from "lucide-react";
import {Dialog,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import {LessonSlide,RichNode,SlideElement,validateRichText} from "@/lib/presentation";
import {SlideTextTools,useSlideText} from "./slide-text-tools";
import {SlideCanvas} from "./slide-canvas";
import {toast} from "sonner";

export function SlideRichEditor({element,slide,theme,onSave,onClose}:{element:SlideElement;slide:LessonSlide;theme:string;onSave:(doc:RichNode)=>void;onClose:()=>void}) {
  const [doc,setDoc]=useState(element.doc),[showPreview,setShowPreview]=useState(false);
  const editor=useSlideText(element,setDoc,true);
  function finish(){if(!editor)return;try{onSave(validateRichText(editor.getJSON()));onClose();}catch(e){toast.error((e as Error).message);}}
  const previewSlide={...slide,elements:slide.elements.map(e=>e.id===element.id?{...e,doc}:e)};
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="q-dialog slide-rich-dialog" onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();finish();}}}>
    <DialogTitle>Edição ampliada de texto</DialogTitle>
    <DialogDescription>Selecione um trecho para formatar. Confira como ele aparece no slide antes de aplicar.</DialogDescription>
    <SlideTextTools editor={editor} element={element}/>
    <div className="slide-rich-edit-area"><EditorContent editor={editor}/></div>
    {showPreview&&<div className="slide-rich-preview"><SlideCanvas slide={previewSlide} theme={theme} eagerImages/><span>Prévia do slide com suas alterações</span></div>}
    <div className="slide-rich-footer"><button type="button" className="btn btn-quiet" aria-pressed={showPreview} onClick={()=>setShowPreview(!showPreview)}>{showPreview?<EyeOff size={17}/>:<Eye size={17}/>}Prévia</button><span className="slide-rich-shortcut">Ctrl/Cmd + Enter para aplicar</span><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" disabled={!editor} onClick={finish}><Check size={17}/>Aplicar</button></div>
  </DialogContent></Dialog>;
}
