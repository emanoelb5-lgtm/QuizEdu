import JSZip from "jszip";
import {XMLParser, XMLValidator} from "fast-xml-parser";
import * as CFB from "cfb";
import {baseElement, FONTS, LessonSlide, MAX_ELEMENTS, MAX_SLIDES, newDeck, newSlide, RichNode, richText, richTextPlain, SlideDeck, SlideElement, SLIDE_HEIGHT, SLIDE_WIDTH, validateDeck} from "./presentation";
import {boundedElement} from "./presentation-editor";

export const PRESENTATION_ACCEPT = ".pptx,.ppsx,.potx,.ppt,.pps,.pot,.odp,.otp,.pdf,.json";
export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;
export type ImportAsset = {id:string; mime:string; data:string};
export type PresentationImport = {deck:SlideDeck; assets:ImportAsset[]; warnings:string[]; format:string};
type Node = {name:string; attrs:Record<string,string>; children:Node[]; text:string};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
const local=(name:string)=>name.split(":").at(-1)!;
const child=(n:Node|undefined,name:string)=>n?.children.find(c=>c.name===name);
const all=(n:Node|undefined,name:string):Node[]=>n?n.children.flatMap(c=>[...(c.name===name?[c]:[]),...all(c,name)]):[];
const txt=(n:Node|undefined):string=>n?n.text+n.children.map(txt).join(""):"";
function xml(text:string):Node {
  if(text.length>2*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error("O arquivo contém XML não permitido ou muito grande.");
  if(XMLValidator.validate(text)!==true)throw new Error("A apresentação contém um documento XML inválido.");
  const raw=new XMLParser({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:"",parseTagValue:false,parseAttributeValue:false,trimValues:false}).parse(text);
  let count=0;
  function nodes(items:any[],depth=0):Node[]{
    if(depth>60)throw new Error("A apresentação contém muitos níveis de objetos.");
    return items.filter(item=>!Object.keys(item)[0].startsWith("?")&&Object.keys(item)[0]!=="#text").map(item=>{
      if(++count>30000)throw new Error("O documento XML contém muitos objetos.");
      const key=Object.keys(item).find(k=>k!==":@")!;
      const values=Array.isArray(item[key])?item[key]:[];
      return {name:local(key),attrs:Object.fromEntries(Object.entries(item[":@"]||{}).sort(([a],[b])=>Number(a.includes(":"))-Number(b.includes(":"))).filter(([k])=>!k.startsWith("xmlns")).map(([k,v])=>[local(k),String(v)])),children:nodes(values,depth+1),text:values.filter((v:any)=>v["#text"]!==undefined).map((v:any)=>String(v["#text"])).join("")};
    });
  }
  return {name:"root",attrs:{},children:nodes(raw),text:""};
}
function base64(bytes:Uint8Array){let result="";for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);}
function imageMime(bytes:Uint8Array):string|null {
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";
  if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return "image/png";
  if(new TextDecoder().decode(bytes.subarray(0,4))==="RIFF"&&new TextDecoder().decode(bytes.subarray(8,12))==="WEBP")return "image/webp";
  return null;
}
function packagePath(from:string,target:string):string {
  if(/^[a-z]+:|^\/\/|\\/i.test(target))throw new Error("Referência externa não permitida.");
  const parts=(target.startsWith("/")?target.slice(1):from.slice(0,from.lastIndexOf("/")+1)+target).split("/");const out:string[]=[];
  for(const p of parts){if(!p||p===".")continue;if(p===".."){if(!out.length)throw new Error("Caminho de arquivo inválido.");out.pop();}else out.push(p);}
  return out.join("/");
}
class Package {
  private expanded=0;
  private cache=new Map<string,Node>();
  private assetCache=new Map<string,string>();
  private mediaBytes=0;
  constructor(public zip:JSZip,public result:PresentationImport){}
  static async open(bytes:Uint8Array,result:PresentationImport){
    const zip=await JSZip.loadAsync(bytes);const files=Object.values(zip.files);if(files.length>5000)throw new Error("A apresentação contém muitos arquivos.");
    let total=0;for(const f of files){const size=(f as any)._data?.uncompressedSize||0;total+=size;if(size>12*1024*1024||total>32*1024*1024)throw new Error("O conteúdo descompactado ultrapassa 32 MB. Divida a apresentação.");}
    return new Package(zip,result);
  }
  async bytes(path:string){const file=this.zip.file(path);if(!file)throw new Error("Parte da apresentação não foi encontrada: "+path);const bytes=await file.async("uint8array");this.expanded+=bytes.length;if(bytes.length>12*1024*1024||this.expanded>48*1024*1024)throw new Error("A apresentação descompactada é muito grande.");return bytes;}
  async document(path:string){if(this.cache.has(path))return this.cache.get(path)!;const doc=xml(new TextDecoder().decode(await this.bytes(path)));this.cache.set(path,doc);return doc;}
  async relations(path:string){const rel=path.slice(0,path.lastIndexOf("/")+1)+"_rels/"+path.slice(path.lastIndexOf("/")+1)+".rels";const out=new Map<string,{path:string;type:string}>();if(!this.zip.file(rel))return out;
    for(const r of all(await this.document(rel),"Relationship")){if(r.attrs.TargetMode==="External")continue;try{out.set(r.attrs.Id,{path:packagePath(path,r.attrs.Target),type:r.attrs.Type});}catch{this.warn("Links e mídias externos precisam ser adicionados novamente.");}}return out;
  }
  warn(message:string){if(!this.result.warnings.includes(message))this.result.warnings.push(message);}
  async asset(path:string){if(this.assetCache.has(path))return this.assetCache.get(path)!;const bytes=await this.bytes(path);const mime=imageMime(bytes);if(!mime){this.warn("Algumas imagens em formato vetorial ou não compatível precisam ser adicionadas novamente (use PNG ou JPEG).");return "";}
    this.mediaBytes+=bytes.length;if(this.mediaBytes>12*1024*1024||this.result.assets.length>=200)throw new Error("As imagens da importação ultrapassam 12 MB ou 200 arquivos. Divida a apresentação.");
    const id=crypto.randomUUID(),src="/api/media/"+id;this.result.assets.push({id,mime,data:base64(bytes)});this.assetCache.set(path,src);return src;
  }
}
function colorOf(n:Node|undefined,theme:Record<string,string>,fallback="#15203d"):string {
  if(!n)return fallback;const srgb=all(n,"srgbClr")[0],scheme=all(n,"schemeClr")[0],system=all(n,"sysClr")[0];
  const value=srgb?.attrs.val||system?.attrs.lastClr;let out=value&&/^[\da-f]{6}$/i.test(value)?"#"+value:theme[scheme?.attrs.val]||fallback;
  const tint=Number(all(n,"tint")[0]?.attrs.val||0)/100000,shade=Number(all(n,"shade")[0]?.attrs.val||100000)/100000;
  if(tint||shade!==1)out="#"+[1,3,5].map(i=>Math.round(clamp(parseInt(out.slice(i,i+2),16)*shade*(1-tint)+255*tint,0,255)).toString(16).padStart(2,"0")).join("");return out;
}
function textDoc(body:Node|undefined,theme:Record<string,string>,scale:number):RichNode {
  const paragraphs=(body?.children||[]).filter(n=>n.name==="p");return {type:"doc",content:paragraphs.map(p=>{
    const props=child(p,"pPr"),defaultRun=child(props,"defRPr");const content:RichNode[]=[];
    if(all(props,"buChar").length)content.push({type:"text",text:all(props,"buChar")[0].attrs.char+" "});
    for(const r of p.children){if(r.name==="br"){content.push({type:"hardBreak"});continue;}if(!["r","fld"].includes(r.name))continue;const value=txt(child(r,"t"));if(!value)continue;
      const style=child(r,"rPr")||defaultRun,marks:NonNullable<RichNode["marks"]>=[];if(style?.attrs.b==="1")marks.push({type:"bold"});if(style?.attrs.i==="1")marks.push({type:"italic"});if(style?.attrs.u&&style.attrs.u!=="none")marks.push({type:"underline"});if(style?.attrs.strike&&style.attrs.strike!=="noStrike")marks.push({type:"strike"});
      const font=child(style,"latin")?.attrs.typeface;const attrs:Record<string,unknown>={color:colorOf(style,theme)};if(font&&FONTS.includes(font))attrs.fontFamily=font;if(style?.attrs.sz)attrs.fontSize=clamp(Number(style.attrs.sz)/100*scale,8,160)+"px";marks.push({type:"textStyle",attrs});content.push({type:"text",text:value,marks});
    }
    const align=({l:"left",ctr:"center",r:"right",just:"justify"} as Record<string,string>)[props?.attrs.algn||""]||"left";return {type:"paragraph",attrs:{textAlign:align},content};
  })};
}
type Transform={sx:number;sy:number;ox:number;oy:number};
function geometry(node:Node,transform:Transform):Partial<SlideElement> {
  const xfrm=child(child(node,"spPr"),"xfrm")||child(node,"xfrm")||all(node,"xfrm")[0],off=child(xfrm,"off"),ext=child(xfrm,"ext");
  return {x:transform.ox+Number(off?.attrs.x||0)*transform.sx,y:transform.oy+Number(off?.attrs.y||0)*transform.sy,w:Number(ext?.attrs.cx||5000000)*transform.sx,h:Number(ext?.attrs.cy||1500000)*transform.sy,rotation:((Number(xfrm?.attrs.rot||0)/60000+180)%360+360)%360-180};
}
async function pptx(pkg:Package){
  const presentation=await pkg.document("ppt/presentation.xml"),rels=await pkg.relations("ppt/presentation.xml"),size=all(presentation,"sldSz")[0];const width=Number(size?.attrs.cx||12192000),height=Number(size?.attrs.cy||6858000);if(width<=0||height<=0)throw new Error("Tamanho de slide inválido.");
  const scale=Math.min(SLIDE_WIDTH/width,SLIDE_HEIGHT/height),transform={sx:scale,sy:scale,ox:(SLIDE_WIDTH-width*scale)/2,oy:(SLIDE_HEIGHT-height*scale)/2};
  if(Math.abs(width/height-16/9)>.03)pkg.warn("Slides de outra proporção foram ajustados à tela 16:9, sem cortar o conteúdo.");
  const ids=all(presentation,"sldId");if(ids.length>MAX_SLIDES)throw new Error("Use até 150 slides por importação.");
  for(const id of ids){const path=rels.get(id.attrs.id)?.path;if(!path)throw new Error("A ordem dos slides contém uma referência inválida.");const root=await pkg.document(path),slideNode=all(root,"sld")[0],slide=newSlide("blank");const relations=await pkg.relations(path);const theme:Record<string,string>={dk1:"#000000",lt1:"#ffffff",dk2:"#15203d",lt2:"#eeeeee",accent1:"#3155ed",accent2:"#168653",accent3:"#d77b08",accent4:"#863de5",accent5:"#087eaa",accent6:"#d33658",tx1:"#15203d",tx2:"#15203d",bg1:"#ffffff",bg2:"#eeeeee"};
    const layoutPath=[...relations.values()].find(r=>r.type.endsWith("/slideLayout"))?.path;const layout=layoutPath?await pkg.document(layoutPath):undefined,layoutRels=layoutPath?await pkg.relations(layoutPath):new Map();
    const masterPath=[...layoutRels.values()].find(r=>r.type.endsWith("/slideMaster"))?.path;const master=masterPath?await pkg.document(masterPath):undefined,masterRels=masterPath?await pkg.relations(masterPath):new Map();const themePath=[...masterRels.values()].find(r=>r.type.endsWith("/theme"))?.path;
    if(themePath){const scheme=all(await pkg.document(themePath),"clrScheme")[0];for(const c of scheme?.children||[])theme[c.name]=colorOf(c,theme);}
    const map=all(slideNode,"overrideClrMapping")[0]||all(master,"clrMap")[0];for(const [a,b] of Object.entries(map?.attrs||{}))if(theme[b])theme[a]=theme[b];
    const background=all(slideNode,"bg")[0]||all(layout,"bg")[0]||all(master,"bg")[0];slide.background.color=colorOf(background,theme,"#ffffff");
    const add=(e:SlideElement)=>{if(slide.elements.length>=MAX_ELEMENTS)throw new Error("Um slide tem mais de 60 objetos. Simplifique-o antes de importar.");slide.elements.push(boundedElement(e));};
    const readTree=async(tree:Node|undefined,rs:Map<string,{path:string;type:string}>,t:Transform,inherit=false)=>{
      for(const node of tree?.children||[]){if(!["sp","pic","graphicFrame","cxnSp","grpSp"].includes(node.name))continue;if(inherit&&all(node,"ph").length)continue;
        if(node.name==="grpSp"){const x=child(child(node,"grpSpPr"),"xfrm"),off=child(x,"off"),ext=child(x,"ext"),chOff=child(x,"chOff"),chExt=child(x,"chExt");const sx=t.sx*Number(ext?.attrs.cx||1)/Number(chExt?.attrs.cx||1),sy=t.sy*Number(ext?.attrs.cy||1)/Number(chExt?.attrs.cy||1);if(!Number.isFinite(sx)||!Number.isFinite(sy))throw new Error("Grupo de objetos inválido.");await readTree(node,rs,{sx,sy,ox:t.ox+Number(off?.attrs.x||0)*t.sx-Number(chOff?.attrs.x||0)*sx,oy:t.oy+Number(off?.attrs.y||0)*t.sy-Number(chOff?.attrs.y||0)*sy},inherit);continue;}
        let source=node;const placeholder=all(node,"ph")[0];if(placeholder&&!all(node,"xfrm").length){const match=all(layout,"sp").find(n=>{const ph=all(n,"ph")[0];return ph&&(ph.attrs.idx||"0")===(placeholder.attrs.idx||"0");});if(match)source=match;}
        const box=geometry(source,t),properties=child(node,"spPr"),fill=child(properties,"solidFill"),line=child(properties,"ln"),body=child(node,"txBody");
        if(node.name==="pic"){const blip=all(node,"blip")[0],image=rs.get(blip?.attrs.embed)?.path;if(image){const src=await pkg.asset(image);if(src)add({...baseElement("image"),...box,src,alt:all(node,"cNvPr")[0]?.attrs.descr||"Imagem importada",fit:"contain",radius:0});}else pkg.warn("Imagens vinculadas externamente precisam ser adicionadas novamente.");continue;}
        const table=all(node,"tbl")[0];if(table){const rows=table.children.filter(n=>n.name==="tr").map(r=>r.children.filter(n=>n.name==="tc").map(c=>all(c,"p").map(p=>all(p,"t").map(txt).join("")).join("\n").slice(0,300)));if(rows.length>20||rows.some(r=>r.length>10))throw new Error("As tabelas importadas podem ter até 20 linhas e 10 colunas.");const columns=Math.max(1,...rows.map(r=>r.length));add({...baseElement("table"),...box,cells:rows.map(r=>Array.from({length:columns},(_,i)=>r[i]||"")),fontSize:20,header:true});continue;}
        const chart=all(node,"chart")[0];if(chart){const chartPath=rs.get(chart.attrs.id)?.path;if(chartPath){const doc=await pkg.document(chartPath),series=all(doc,"ser")[0],labels=all(child(series,"cat"),"pt").map(p=>txt(child(p,"v"))).slice(0,12),values=all(child(series,"val"),"pt").map(p=>Number(txt(child(p,"v")))).slice(0,12);if(labels.length&&labels.length===values.length&&values.every(n=>Number.isFinite(n)&&n>=0&&n<=1e9))add({...baseElement("chart"),...box,labels:labels.map(v=>v.slice(0,80)),values,chart:all(doc,"pieChart").length?"pie":all(doc,"lineChart").length?"line":"bar"});else pkg.warn("Um gráfico complexo precisa ser recriado no editor.");if(all(doc,"ser").length>1)pkg.warn("Gráficos com várias séries importam a primeira série; confira os dados.");}continue;}
        const preset=all(properties,"prstGeom")[0]?.attrs.prst;const shapeMap:Record<string,SlideElement["shape"]>={rect:"rect",roundRect:"rect",ellipse:"ellipse",line:"line",triangle:"triangle",rtTriangle:"triangle",rightArrow:"arrow",leftArrow:"arrow"};
        if(fill||line||(!body&&preset)){add({...baseElement("shape"),...box,shape:shapeMap[preset]||"rect",fill:fill?colorOf(fill,theme,"#ffffff"):"#ffffff",stroke:colorOf(line,theme,"#ffffff"),strokeWidth:clamp(Number(line?.attrs.w||0)*t.sx,0,20),radius:preset==="roundRect"?12:0,fillOpacity:child(properties,"noFill")?0:100});if(preset&&!shapeMap[preset])pkg.warn("Algumas formas especiais foram aproximadas por formas simples.");}
        if(body){const fontScale=scale*914400/72;const doc=textDoc(body,theme,fontScale);const plain=richTextPlain(doc);if(plain.trim()){const run=all(body,"rPr")[0]||all(body,"defRPr")[0],font=all(body,"latin")[0]?.attrs.typeface;const e={...baseElement("text"),...box,doc,font:FONTS.includes(font)?font:"Arial",fontSize:clamp(Number(run?.attrs.sz||2400)/100*fontScale,8,160),color:colorOf(run,theme),align:({l:"left",ctr:"center",r:"right",just:"justify"} as Record<string,SlideElement["align"]>)[all(body,"pPr")[0]?.attrs.algn]||"left"};add(e);if(font&&!FONTS.includes(font))pkg.warn("Fontes não disponíveis foram substituídas por Arial.");}}
        if(all(node,"custGeom").length)pkg.warn("Desenhos livres e SmartArt precisam ser conferidos no editor.");
      }
    };
    if(slideNode?.attrs.showMasterSp!=="0")await readTree(all(master,"spTree")[0],masterRels,transform,true);await readTree(all(layout,"spTree")[0],layoutRels,transform,true);await readTree(all(slideNode,"spTree")[0],relations,transform);
    const bgImage=all(background,"blip")[0];if(bgImage){const src=relations.get(bgImage.attrs.embed)||layoutRels.get(bgImage.attrs.embed)||masterRels.get(bgImage.attrs.embed);if(src)slide.background.image=await pkg.asset(src.path)||undefined;}
    const notesPath=[...relations.values()].find(r=>r.type.endsWith("/notesSlide"))?.path;if(notesPath){const notes=await pkg.document(notesPath);slide.notes=all(notes,"sp").filter(n=>!all(n,"ph").length||all(n,"ph")[0]?.attrs.type==="body").flatMap(n=>all(n,"p").map(p=>all(p,"t").map(txt).join(""))).join("\n").slice(0,5000);}
    if(all(root,"timing").length)pkg.warn("Animações e efeitos avançados não são importados. Use as entradas e transições do QuizEdu.");
    slide.title=slide.elements.filter(e=>e.type==="text").map(e=>richTextPlain(e.doc)).find(Boolean)?.split("\n")[0].slice(0,100)||`Slide ${pkg.result.deck.slides.length+1}`;pkg.result.deck.slides.push(slide);
  }
}
function measurement(value:string|undefined){const match=value?.match(/^(-?[\d.]+)(cm|mm|in|pt|px)?$/);if(!match)return 0;return Number(match[1])*({cm:37.79527559,mm:3.779527559,in:96,pt:96/72,px:1}[match[2] as "cm"]||1);}
async function odp(pkg:Package){
  const root=await pkg.document("content.xml"),styles=pkg.zip.file("styles.xml")?await pkg.document("styles.xml"):root;const styleMap=new Map([...all(styles,"style"),...all(root,"style")].map(n=>[n.attrs.name,n]));const masters=new Map(all(styles,"master-page").map(n=>[n.attrs.name,n]));const pages=all(all(root,"presentation")[0],"page");if(pages.length>MAX_SLIDES)throw new Error("Use até 150 slides.");
  for(const page of pages){const master=masters.get(page.attrs["master-page-name"]),layout=all(styles,"page-layout").find(n=>n.attrs.name===master?.attrs["page-layout-name"]),props=child(layout,"page-layout-properties"),width=measurement(props?.attrs["page-width"])||1280,height=measurement(props?.attrs["page-height"])||720,scale=Math.min(SLIDE_WIDTH/width,SLIDE_HEIGHT/height);const slide=newSlide("blank");slide.title=(page.attrs.name||`Slide ${pkg.result.deck.slides.length+1}`).slice(0,100);
    const pageStyle=styleMap.get(page.attrs["style-name"]),background=child(pageStyle,"drawing-page-properties")?.attrs["fill-color"];if(background&&/^#[\da-f]{6}$/i.test(background))slide.background.color=background;
    const read=async(node:Node)=>{for(const item of node.children){if(item.name==="notes"){slide.notes=all(item,"p").map(txt).join("\n").slice(0,5000);continue;}if(item.name==="g"){pkg.warn("Grupos do LibreOffice foram desagrupados; confira sua posição.");await read(item);continue;}if(!["frame","rect","ellipse","line","custom-shape"].includes(item.name))continue;
      const st=styleMap.get(item.attrs["style-name"]),graphic=child(st,"graphic-properties"),fontProps=child(st,"text-properties"),paragraphProps=child(st,"paragraph-properties");const box={x:(SLIDE_WIDTH-width*scale)/2+measurement(item.attrs.x)*scale,y:(SLIDE_HEIGHT-height*scale)/2+measurement(item.attrs.y)*scale,w:measurement(item.attrs.width)*scale||400,h:measurement(item.attrs.height)*scale||100};const add=(e:SlideElement)=>{if(slide.elements.length>=MAX_ELEMENTS)throw new Error("Um slide tem mais de 60 objetos.");slide.elements.push(boundedElement(e));};
      const image=child(item,"image");if(image){const href=image.attrs.href;if(href&&!/^https?:|^data:/i.test(href)){const src=await pkg.asset(packagePath("",href));if(src)add({...baseElement("image"),...box,src,alt:txt(child(item,"desc")).slice(0,300)||"Imagem importada",fit:"contain",radius:0});}else pkg.warn("Imagens externas precisam ser adicionadas novamente.");continue;}
      const table=all(item,"table")[0];if(table){const rows=table.children.filter(n=>n.name==="table-row").map(r=>r.children.filter(n=>n.name==="table-cell").map(c=>all(c,"p").map(txt).join("\n").slice(0,300)));const columns=Math.max(1,...rows.map(r=>r.length));if(rows.length>20||columns>10)throw new Error("Tabela maior que 20 linhas ou 10 colunas.");add({...baseElement("table"),...box,cells:rows.map(r=>Array.from({length:columns},(_,i)=>r[i]||""))});continue;}
      const paragraphs=all(item,"p"),content=paragraphs.map(txt).join("\n");if(content.trim()){const font=fontProps?.attrs["font-family"]?.replace(/'/g,"")||"Arial",color=fontProps?.attrs.color;const e={...baseElement("text"),...box,doc:richText(content),font:FONTS.includes(font)?font:"Arial",fontSize:clamp(measurement(fontProps?.attrs["font-size"])*scale||28,8,160),color:color&&/^#[\da-f]{6}$/i.test(color)?color:"#15203d",align:["left","center","right","justify"].includes(paragraphProps?.attrs["text-align"]||"")?paragraphProps!.attrs["text-align"] as SlideElement["align"]:"left"};if(fontProps?.attrs["font-weight"]==="bold")e.doc.content?.forEach(p=>p.content?.forEach(t=>t.marks=[{type:"bold"}]));add(e);}else if(item.name!=="frame"){const fill=graphic?.attrs["fill-color"],stroke=graphic?.attrs["stroke-color"];add({...baseElement("shape"),...box,shape:item.name==="ellipse"?"ellipse":item.name==="line"?"line":"rect",fill:fill&&/^#[\da-f]{6}$/i.test(fill)?fill:"#eaf0ff",stroke:stroke&&/^#[\da-f]{6}$/i.test(stroke)?stroke:"#3155ed",radius:0});}else if(all(item,"object").length)pkg.warn("Objetos e gráficos incorporados do LibreOffice precisam ser recriados no editor.");if(item.attrs.transform)pkg.warn("Transformações do LibreOffice precisam ser conferidas no editor.");
    }};await read(page);pkg.result.deck.slides.push(slide);
  }
  pkg.warn("A formatação básica do LibreOffice é importada. Animações, estilos avançados e objetos incorporados podem precisar de ajustes.");
}
type RecordNode={type:number;instance:number;start:number;end:number;children:RecordNode[]};
export function parseLegacyPowerPoint(stream:Uint8Array,current:Uint8Array):LessonSlide[]{
  const view=new DataView(stream.buffer,stream.byteOffset,stream.byteLength);let count=0;
  const record=(at:number,depth=0):RecordNode=>{if(depth>40||++count>100000||at<0||at+8>stream.length)throw new Error("Arquivo PowerPoint antigo inválido.");const header=view.getUint16(at,true),length=view.getUint32(at+4,true),end=at+8+length;if(end>stream.length)throw new Error("Arquivo PowerPoint antigo incompleto.");const n={type:view.getUint16(at+2,true),instance:header>>4,start:at+8,end,children:[] as RecordNode[]};if((header&15)===15)for(let p=n.start;p<n.end;){const child=record(p,depth+1);n.children.push(child);p=child.end;}return n;};
  const find=(n:RecordNode,type:number):RecordNode[]=>n.children.flatMap(c=>[...(c.type===type?[c]:[]),...find(c,type)]);
  if(current.length<20)throw new Error("Arquivo PowerPoint antigo sem dados de edição.");const cv=new DataView(current.buffer,current.byteOffset,current.byteLength);if(cv.getUint32(12,true)!==0xE391C05F)throw new Error("Apresentações protegidas por senha não podem ser importadas.");let edit=cv.getUint32(16,true),docId=0;const persist=new Map<number,number>(),visited=new Set<number>();
  while(edit){if(visited.has(edit)||visited.size>1000)throw new Error("Histórico PowerPoint inválido.");visited.add(edit);const r=record(edit);if(r.type!==4085||r.end-r.start<28)throw new Error("Registro de edição PowerPoint inválido.");if(!docId)docId=view.getUint32(r.start+16,true);if(r.end-r.start>=32&&view.getUint32(r.start+28,true))throw new Error("Apresentações protegidas por senha não podem ser importadas.");const directory=record(view.getUint32(r.start+12,true));if(directory.type!==6002)throw new Error("Diretório PowerPoint inválido.");for(let p=directory.start;p<directory.end;){const value=view.getUint32(p,true);p+=4;const id=value&0xfffff,total=value>>>20;if(p+total*4>directory.end)throw new Error("Diretório PowerPoint incompleto.");for(let i=0;i<total;i++,p+=4)if(!persist.has(id+i))persist.set(id+i,view.getUint32(p,true));}edit=view.getUint32(r.start+8,true);}
  const document=record(persist.get(docId)??-1),list=find(document,4080).find(r=>r.instance===0);if(!list)throw new Error("Não foram encontrados slides neste PowerPoint.");
  const decode=(r:RecordNode)=>new TextDecoder(r.type===4000?"utf-16le":"windows-1252").decode(stream.subarray(r.start,r.end)).replace(/[\u0000\u000b]/g,"").replace(/\r/g,"\n");const slides:LessonSlide[]=[];let texts:string[]=[];let target:RecordNode|null=null;
  const finish=()=>{if(!target)return;const inside=[...find(target,4000),...find(target,4008)].sort((a,b)=>a.start-b.start).map(decode);const chunks=[...texts,...inside].filter(t=>t.trim());const slide=newSlide("blank");slide.title=(chunks[0]||`Slide ${slides.length+1}`).split("\n")[0].slice(0,100);if(chunks.length)slide.elements=[{...baseElement("text"),x:60,y:45,w:880,h:475,fontSize:28,doc:richText(chunks.join("\n\n").slice(0,16000))}];slides.push(slide);};
  for(const r of list.children){if(r.type===1011){finish();if(slides.length>=MAX_SLIDES)throw new Error("Use até 150 slides.");target=record(persist.get(view.getUint32(r.start,true))??-1);texts=[];}else if([4000,4008].includes(r.type))texts.push(decode(r));}finish();return slides;
}
export async function importPresentation(bytes:Uint8Array,name:string):Promise<PresentationImport>{
  if(bytes.length>MAX_IMPORT_BYTES)throw new Error("Use um arquivo de até 15 MB.");const extension=name.toLowerCase().split(".").at(-1)||"";const deck=newDeck();deck.title=name.replace(/\.[^.]+$/,"").slice(0,100)||"Apresentação importada";deck.slides=[];const result:PresentationImport={deck,assets:[],warnings:[],format:extension.toUpperCase()};
  if(extension==="json"){if(bytes.length>1048576)throw new Error("O arquivo QuizEdu pode ter até 1 MB.");const data=JSON.parse(new TextDecoder().decode(bytes));result.deck=validateDeck(data.deck||data);return result;}
  if(["ppt","pps","pot"].includes(extension)){
    if(bytes[0]!==0xd0||bytes[1]!==0xcf)throw new Error("Este arquivo não é um PowerPoint antigo válido.");const cfb=CFB.read(bytes,{type:"array"}),stream=CFB.find(cfb,"PowerPoint Document"),current=CFB.find(cfb,"Current User");if(!stream?.content||!current?.content)throw new Error("PowerPoint antigo inválido ou protegido por senha.");deck.slides=parseLegacyPowerPoint(new Uint8Array(stream.content),new Uint8Array(current.content));result.warnings.push("PowerPoint antigo: os textos são recuperados por slide em caixas editáveis. Imagens, layout, notas e efeitos não são preservados. Para maior fidelidade, abra o original no PowerPoint ou LibreOffice e salve como PPTX.");
  }else if(["pptx","ppsx","potx","odp","otp"].includes(extension)){const pkg=await Package.open(bytes,result);if(["odp","otp"].includes(extension))await odp(pkg);else await pptx(pkg);}
  else throw new Error("Escolha PowerPoint (PPT/PPTX/PPS/PPSX/POT/POTX), LibreOffice (ODP/OTP), PDF ou uma aula QuizEdu (JSON).");
  if(!deck.slides.length)throw new Error("Nenhum slide foi encontrado neste arquivo.");result.deck=validateDeck(deck);if(new TextEncoder().encode(JSON.stringify(deck)).length>1048576)throw new Error("O documento importado ultrapassa 1 MB. Divida a apresentação.");return result;
}
