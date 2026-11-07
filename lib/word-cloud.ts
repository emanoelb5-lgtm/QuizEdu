export const WORD_CLOUD_POINTS=100;
export const MAX_CLOUD_WORD_LENGTH=40;
export const MAX_CLOUD_WORDS=1000;
export type CloudWord={id:string;word:string};
export type RoomWordCloud={slideId:string;prompt:string;accepting:boolean;words:CloudWord[];myWords:CloudWord[];pointsPerWord:number};
export type CloudReport={slideId:string;prompt:string;words:(CloudWord&{playerId:string;playerName:string})[]};

export function cloudWord(value:unknown):{word:string;key:string}{
  if(typeof value!=="string")throw new Error("Digite uma palavra para participar.");
  const word=value.normalize("NFC").trim().replaceAll("’","'");
  if(!word||word.length>MAX_CLOUD_WORD_LENGTH)throw new Error("Use uma palavra de até 40 caracteres.");
  if(/\s/u.test(word))throw new Error("Envie uma palavra por vez. Você pode enviar várias, uma após a outra.");
  if(!/^[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[-'][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*$/u.test(word))throw new Error("Use letras e números. Hífen e apóstrofo são permitidos dentro da palavra.");
  return {word,key:word.toLocaleLowerCase("pt-BR")};
}
