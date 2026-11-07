import type {PresentationImport} from "./presentation-import";
import {duplicateSlide,LessonSlide,SlideDeck,validateDeck} from "./presentation";

type OpenSteps={
  beforeOpen?:()=>Promise<void>;
  prepare:()=>Promise<PresentationImport>;
  resolve:(result:PresentationImport,slides:LessonSlide[])=>Promise<LessonSlide[]>;
  save:(deck:SlideDeck)=>Promise<void>;
};
/** Save current work first, then open every imported slide as a separate document. */
export async function openPresentationFile(steps:OpenSteps):Promise<{deck:SlideDeck;warnings:string[]}>{
  await steps.beforeOpen?.();
  const result=await steps.prepare();
  const deck=validateDeck({...result.deck,id:crypto.randomUUID(),slides:result.deck.slides.map(duplicateSlide)});
  deck.slides=await steps.resolve(result,deck.slides);
  const clean=validateDeck(deck);
  await steps.save(clean);
  return {deck:clean,warnings:result.warnings};
}
