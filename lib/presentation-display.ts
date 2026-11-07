import type {RoomState} from "./quiz";

export const RANKING_SPOTLIGHT_MS=6000;
export type RankingSpotlight={key:string;endsAt:number};

// Announce each completed round once; repeated polls and review never restart it.
export class RankingSpotlightSequence {
  private room="";
  private completed=-1;
  observe(state:Pick<RoomState,"code"|"status"|"index"|"presentation"|"lastRoundIsPoll">,now:number):RankingSpotlight|null|undefined {
    const changedRoom=this.room!==state.code;
    if(changedRoom){this.room=state.code;this.completed=-1;}
    if(state.lastRoundIsPoll){this.completed=Math.max(this.completed,state.index);return null;}
    const p=state.presentation;
    if(!p||p.blackout||p.review||["lobby","question","wordcloud","finished","closed"].includes(state.status))return null;
    // A projector can miss the short results state if the teacher advances
    // immediately; the next content slide still identifies the completed round.
    if(["results","slide"].includes(state.status)&&state.index>this.completed){
      this.completed=state.index;
      return {key:`${state.code}:${state.index}`,endsAt:now+RANKING_SPOTLIGHT_MS};
    }
    return changedRoom?null:undefined;
  }
}
export function spotlightRemaining(value:RankingSpotlight,now:number){return Math.max(0,Math.min(RANKING_SPOTLIGHT_MS,value.endsAt-now));}

// Stable styles keep words moving through live updates. Size is purely visual:
// all accepted words continue earning the same 100 points on the server.
export function cloudWordAppearance(id:string,count:number,length:number){
  let seed=2166136261;
  for(const char of id){seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;}
  const base=count<8?82:count<20?62:count<45?45:count<90?34:count<180?26:20;
  const factor=.72+(seed%39)/100;
  const fontSize=Math.max(14,Math.round(Math.min(base*factor,length>24?46:length>15?62:100)));
  const colors=["#6546d7","#137d61","#116dae","#b9542d","#7e3da8","#b33460"];
  return {fontSize,color:colors[seed%colors.length],duration:7+(seed%51)/10,delay:-(seed%120)/10,driftX:seed%9-4,driftY:-(3+seed%5)};
}
