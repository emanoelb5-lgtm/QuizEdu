import {sampleQuiz} from "./quiz";
import {sampleDeck} from "./presentation";
import {json} from "./server";

// Shared content for the web and Android editors. Each request has fresh IDs,
// so using an example creates an independent editable copy.
export function readExamples(){return json({version:1,quiz:sampleQuiz(),presentation:sampleDeck()});}
