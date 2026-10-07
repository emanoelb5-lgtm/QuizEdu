"use client";
import { useEffect, useRef, useState } from "react";

export function ActionDock({children,dark=false,className=""}:{children:React.ReactNode;dark?:boolean;className?:string}) {
  const ref=useRef<HTMLElement>(null);
  const [bottom,setBottom]=useState(0);
  useEffect(()=>{
    const footer=ref.current,owner=footer?.parentElement;
    if(!footer||!owner)return;
    const reserve=()=>owner.style.setProperty("--action-dock-height",`${footer.getBoundingClientRect().height}px`);
    const observer=new ResizeObserver(reserve);observer.observe(footer);reserve();
    // Keep the action above an on-screen keyboard and browser zoom viewport.
    const viewport=window.visualViewport;
    const position=()=>setBottom(viewport?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0);
    position();viewport?.addEventListener("resize",position);viewport?.addEventListener("scroll",position);
    return()=>{observer.disconnect();viewport?.removeEventListener("resize",position);viewport?.removeEventListener("scroll",position);owner.style.removeProperty("--action-dock-height");};
  },[]);
  return <footer ref={ref} className={`action-dock ${dark?"action-dock-dark":""} ${className}`} style={{bottom}}><div className="action-dock-inner">{children}</div></footer>;
}
