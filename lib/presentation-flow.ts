import type {RoomState} from "./quiz";
import {allowedSlide,deckQuestions,questionIndexAt,SlideDeck,slideSteps} from "./presentation";
export type PresentationProgress={status:RoomState["status"];questionIndex:number;slideIndex:number;step:number;blackout:boolean};
export function movePresentation(deck:SlideDeck,current:PresentationProgress,action:string,target?:number,blackout?:boolean):PresentationProgress & {newRound:boolean} {
  const state={...current,newRound:false};const fail=(text:string):never=>{throw new Error(text);};
  if(action==="close")return {...state,status:"closed",blackout:false};
  if(action==="end_round"&&current.status==="question")return {...state,status:"results"};
  if(action==="blackout"){if(!["slide","results"].includes(current.status)||typeof blackout!=="boolean")fail("A tela pode ser pausada entre as perguntas.");return {...state,blackout:blackout!};}
  if(action==="start"&&current.status==="lobby")target=0;
  else if(["slide","results"].includes(current.status)){
    if(action==="next") {const max=slideSteps(deck.slides[current.slideIndex]);if(current.status==="slide"&&current.step<max)return {...state,step:current.step+1,blackout:false};target=current.slideIndex+1;}
    else if(action==="previous"){if(current.status==="slide"&&current.step>0)return {...state,step:current.step-1,blackout:false};target=current.slideIndex-1;}
    else if(action!=="goto")fail("Essa ação não está disponível agora.");
  }else fail("Conclua a pergunta antes de mudar de slide.");
  if(target===deck.slides.length&&action==="next"){if(current.questionIndex+1<deckQuestions(deck).length)fail("Apresente as perguntas anteriores antes de concluir a aula.");return {...state,status:"finished",blackout:false};}
  if(target===undefined||!allowedSlide(deck,target,current.questionIndex))fail("Avance até a próxima pergunta antes de ir para esse slide.");
  const slide=deck.slides[target!];const index=questionIndexAt(deck,target!);
  if(slide.kind==="question"&&index>current.questionIndex){state.status="question";state.questionIndex=index;state.newRound=true;}
  else state.status="slide";
  state.slideIndex=target!;state.step=action==="previous"?slideSteps(slide):0;state.blackout=false;
  return state;
}
