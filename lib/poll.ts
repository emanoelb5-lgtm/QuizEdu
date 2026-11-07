import type {Question} from "./quiz";
export const MAX_POLL_OPTIONS=8;
export type PollResults={allowMultiple:boolean;revealed:boolean;respondents:number;myChoices:number[];counts?:number[];percentages?:number[]};
export function pollChoices(value:unknown,question:Pick<Question,"options"|"allowMultiple">):number[]{
  if(!Array.isArray(value)||!value.length||value.length>question.options.length||value.some(v=>!Number.isInteger(v)||v<0||v>=question.options.length)||new Set(value).size!==value.length)throw new Error("Marque pelo menos uma opção válida, sem repetir opções.");
  if(!question.allowMultiple&&value.length!==1)throw new Error("Esta enquete permite escolher apenas uma opção.");
  return [...value].sort((a,b)=>a-b);
}
export function pollSummary(optionCount:number,votes:number[][]){
  const counts=Array.from({length:optionCount},(_,i)=>votes.filter(v=>v.includes(i)).length);
  return {respondents:votes.length,counts,percentages:counts.map(n=>votes.length?Math.round(n/votes.length*1000)/10:0)};
}
