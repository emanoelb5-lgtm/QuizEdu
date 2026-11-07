import {sampleQuiz} from "./quiz";
import {sampleDeck} from "./presentation";
import {HttpError,json} from "./server";
import {contosExample} from "./contos-example";
import {CONTOS_EXAMPLE} from "./example-catalog";

// Shared content for the web and Android editors. Each request has fresh IDs,
// so using an example creates an independent editable copy.
export function readExamples(request?:Request){
  const selected=request?new URL(request.url).searchParams.get("example"):null;
  if(selected===CONTOS_EXAMPLE.id)return json({version:1,example:CONTOS_EXAMPLE,...contosExample()});
  if(selected)throw new HttpError(404,"Este exemplo não foi encontrado.");
  return json({version:1,quiz:sampleQuiz(),presentation:sampleDeck()});
}
