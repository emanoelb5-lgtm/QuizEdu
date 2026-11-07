import type {ReactNode} from "react";
export function PolicyLayout({title,children}:{title:string;children:ReactNode}){
 return <main style={{maxWidth:820,margin:"auto",padding:"40px 24px 80px",lineHeight:1.75}}><a href="/" className="btn btn-outline">← Prativerso</a><h1 style={{fontSize:"clamp(30px,6vw,46px)",lineHeight:1.15,margin:"32px 0 12px"}}>{title}</h1><div style={{fontSize:17}}>{children}</div><nav style={{display:"flex",gap:20,flexWrap:"wrap",marginTop:40}}><a href="/privacidade">Privacidade</a><a href="/termos">Termos de uso</a><a href="/excluir-conta">Excluir conta e dados</a><a href="/contato">Contato</a></nav></main>;
}
