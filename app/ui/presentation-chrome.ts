"use client";
import {useCallback,useEffect,useRef,useState} from "react";

export function usePresentationChrome(){
  const [visible,setVisible]=useState(true);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const reveal=useCallback(()=>{
    setVisible(true);
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>setVisible(false),3500);
  },[]);
  useEffect(()=>{reveal();return()=>{if(timer.current)clearTimeout(timer.current);};},[reveal]);
  return {visible,reveal};
}
