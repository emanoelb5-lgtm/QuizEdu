"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {EditorContent,useEditor,type Editor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {TextStyleKit} from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import {AlignCenter,AlignJustify,AlignLeft,AlignRight,Bold,Check,Italic,Link as LinkIcon,List,ListOrdered,Maximize2,Redo2,RemoveFormatting,Strikethrough,Underline,Undo2} from "lucide-react";
import {Popover,PopoverContent,PopoverTrigger} from "@/components/ui/popover";
import {FONTS,RichNode,safeLink,SlideElement,validateRichText} from "@/lib/presentation";
import {toast} from "sonner";

const sizes=[8,12,16,20,24,28,32,36,40,48,56,64,72,96,120,160];
const colors=["#172554","#3155ed","#ffffff","#111827","#168653","#d33658","#d77b08","#863de5"];

export function useSlideText(element:SlideElement,onChange?:(doc:RichNode)=>void,autofocus=false) {
  const [,update]=useState(0);
  const valid=useRef(element.doc);
  const editor=useEditor({
    immediatelyRender:false,
    extensions:[StarterKit.configure({codeBlock:false,link:{openOnClick:false}}),TextStyleKit,TextAlign.configure({types:["heading","paragraph"]})],
    content:element.doc,
    editorProps:{attributes:{class:"slide-rich-editor-content",role:"textbox","aria-label":"Texto do slide","aria-multiline":"true",style:`font-family:${element.font||"Arial"};font-size:${element.fontSize||30}px;color:${element.color||"#15203d"};text-align:${element.align||"left"}`}},
    onSelectionUpdate:()=>update(v=>v+1),
    onUpdate:({editor})=>{
      try {const doc=validateRichText(editor.getJSON());valid.current=doc;onChange?.(doc);}
      catch(error){toast.error((error as Error).message);if(valid.current)editor.commands.setContent(valid.current,{emitUpdate:false});}
      update(v=>v+1);
    },
  });
  useEffect(()=>{if(!editor||!autofocus)return;const frame=requestAnimationFrame(()=>editor.commands.focus("end"));return()=>cancelAnimationFrame(frame);},[editor,autofocus]);
  return editor;
}

export function SlideTextTools({editor,element}:{editor:Editor|null;element:SlideElement}) {
  const [linkOpen,setLinkOpen]=useState(false),[href,setHref]=useState(""),[linkError,setLinkError]=useState("");
  const attrs=editor?.getAttributes("textStyle")||{};
  const font=attrs.fontFamily||element.font||"Arial",size=String(parseFloat(attrs.fontSize||String(element.fontSize||30)));
  const sizeOptions=[...new Set([...sizes.map(String),size])].sort((a,b)=>Number(a)-Number(b));
  const textColor=attrs.color||element.color||"#15203d";
  function applyLink(){const url=safeLink(href.trim());if(!url){setLinkError("Use um endereço http ou https válido.");return;}editor?.chain().focus().extendMarkRange("link").setLink({href:url}).run();setLinkOpen(false);}
  const buttons=[
    {label:"Negrito · Ctrl B",Icon:Bold,active:editor?.isActive("bold"),run:()=>editor?.chain().focus().toggleBold().run()},
    {label:"Itálico · Ctrl I",Icon:Italic,active:editor?.isActive("italic"),run:()=>editor?.chain().focus().toggleItalic().run()},
    {label:"Sublinhado · Ctrl U",Icon:Underline,active:editor?.isActive("underline"),run:()=>editor?.chain().focus().toggleUnderline().run()},
    {label:"Tachado",Icon:Strikethrough,active:editor?.isActive("strike"),run:()=>editor?.chain().focus().toggleStrike().run()},
    {label:"Lista com marcadores",Icon:List,active:editor?.isActive("bulletList"),run:()=>editor?.chain().focus().toggleBulletList().run()},
    {label:"Lista numerada",Icon:ListOrdered,active:editor?.isActive("orderedList"),run:()=>editor?.chain().focus().toggleOrderedList().run()},
  ];
  return <div className="slide-text-toolbar" aria-label="Formatação do texto">
    <div className="slide-text-tool-group">
      <select aria-label="Fonte do texto selecionado" value={font} disabled={!editor} onChange={e=>editor?.chain().focus().setFontFamily(e.target.value).run()}>{FONTS.map(f=><option key={f}>{f}</option>)}</select>
      <select aria-label="Tamanho do texto selecionado" value={size} disabled={!editor} onChange={e=>editor?.chain().focus().setFontSize(e.target.value+"px").run()}>{sizeOptions.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <select aria-label="Estilo do parágrafo" value={editor?.isActive("heading",{level:1})?"h1":editor?.isActive("heading",{level:2})?"h2":"p"} disabled={!editor} onChange={e=>e.target.value==="p"?editor?.chain().focus().setParagraph().run():editor?.chain().focus().setHeading({level:e.target.value==="h1"?1:2}).run()}><option value="p">Parágrafo</option><option value="h1">Título</option><option value="h2">Subtítulo</option></select>
    </div>
    <div className="slide-text-tool-group">{buttons.map(b=><button type="button" key={b.label} title={b.label} aria-label={b.label} aria-pressed={!!b.active} disabled={!editor} onMouseDown={e=>e.preventDefault()} onClick={b.run}><b.Icon size={18}/></button>)}</div>
    <div className="slide-text-tool-group">{[{value:"left",label:"Alinhar à esquerda",Icon:AlignLeft},{value:"center",label:"Centralizar texto",Icon:AlignCenter},{value:"right",label:"Alinhar à direita",Icon:AlignRight},{value:"justify",label:"Justificar texto",Icon:AlignJustify}].map(b=><button type="button" key={b.value} title={b.label} aria-label={b.label} aria-pressed={editor?.isActive({textAlign:b.value})||(!editor?.getAttributes(editor.isActive("heading")?"heading":"paragraph").textAlign&&element.align===b.value)} disabled={!editor} onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().setTextAlign(b.value).run()}><b.Icon size={18}/></button>)}</div>
    <div className="slide-text-tool-group">
      <Popover><PopoverTrigger asChild><button type="button" aria-label="Cor do texto selecionado" title="Cor do texto selecionado" disabled={!editor} className="slide-text-color-trigger"><span style={{borderColor:textColor}}>A</span></button></PopoverTrigger><PopoverContent className="slide-text-popover" onCloseAutoFocus={event=>{event.preventDefault();editor?.commands.focus();}}><b>Cor do texto</b><div className="slide-text-color-swatches">{colors.map(c=><button type="button" key={c} aria-label={`Usar cor ${c}`} aria-pressed={textColor.toLowerCase()===c} style={{background:c}} onClick={()=>editor?.chain().focus().setColor(c).run()}/>)}</div><label>Outra cor<input type="color" value={textColor} onChange={e=>editor?.chain().focus().setColor(e.target.value).run()}/></label></PopoverContent></Popover>
      <Popover open={linkOpen} onOpenChange={open=>{setLinkOpen(open);if(open){setHref(editor?.getAttributes("link").href||"");setLinkError("");}}}><PopoverTrigger asChild><button type="button" aria-label="Editar link" title="Editar link" disabled={!editor} aria-pressed={!!editor?.isActive("link")}><LinkIcon size={18}/></button></PopoverTrigger><PopoverContent className="slide-text-popover" onCloseAutoFocus={event=>{event.preventDefault();editor?.commands.focus();}}><form onSubmit={e=>{e.preventDefault();applyLink();}}><label>Endereço do link<input type="url" value={href} onChange={e=>{setHref(e.target.value);setLinkError("");}} placeholder="https://…" aria-invalid={!!linkError}/></label>{linkError&&<p role="alert">{linkError}</p>}<div><button className="btn btn-outline" type="button" disabled={!editor?.isActive("link")} onClick={()=>{editor?.chain().focus().extendMarkRange("link").unsetLink().run();setLinkOpen(false);}}>Remover</button><button type="submit" className="btn btn-primary">Aplicar</button></div></form></PopoverContent></Popover>
      <button type="button" title="Limpar formatação do trecho" aria-label="Limpar formatação do trecho" disabled={!editor} onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={18}/></button>
      <button type="button" title="Desfazer texto" aria-label="Desfazer texto" disabled={!editor?.can().undo()} onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().undo().run()}><Undo2 size={18}/></button>
      <button type="button" title="Refazer texto" aria-label="Refazer texto" disabled={!editor?.can().redo()} onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().redo().run()}><Redo2 size={18}/></button>
    </div>
  </div>;
}

export function SlideInlineTextEditor({element,toolbarHost,onChange,onDone,onExpand}:{element:SlideElement;toolbarHost:HTMLElement|null;onChange:(doc:RichNode)=>void;onDone:()=>void;onExpand:()=>void}) {
  const editor=useSlideText(element,onChange,true);
  const [overflow,setOverflow]=useState(false);
  useEffect(()=>{if(!editor)return;const measure=()=>setOverflow(editor.view.dom.scrollHeight>element.h+2);measure();editor.on("update",measure);return()=>{editor.off("update",measure);};},[editor,element.h,element.w,element.fontSize,element.font,element.align]);
  return <>
    <div className="slide-inline-text" style={{height:element.h}} onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Escape"||(e.key==="Enter"&&(e.ctrlKey||e.metaKey))){e.preventDefault();e.stopPropagation();onDone();}}}><EditorContent editor={editor}/></div>
    {toolbarHost&&createPortal(<div className="presentation-text-bar" onPointerDown={e=>e.stopPropagation()}><div className="presentation-text-bar-heading"><span><TypeLabel/>Editando texto</span>{overflow&&<span className="slide-text-overflow" role="status">O texto excede a caixa. Aumente a altura ou reduza a fonte.</span>}<div><button type="button" onClick={onExpand} title="Abrir edição ampliada"><Maximize2 size={16}/>Ampliar</button><button type="button" className="slide-text-done" onClick={onDone}><Check size={16}/>Concluir</button></div></div><SlideTextTools editor={editor} element={element}/></div>,toolbarHost)}
  </>;
}
function TypeLabel(){return <span aria-hidden="true" className="slide-text-type-label">T</span>;}
