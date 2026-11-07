"use client";
export async function uploadSlideImage(file:File):Promise<{url:string;width:number;height:number}>{
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Escolha uma imagem JPEG, PNG ou WebP.");
  if(file.size>12*1024*1024)throw new Error("Escolha uma imagem de até 12 MB.");
  const bitmap=await createImageBitmap(file),width=bitmap.width,height=bitmap.height;
  const scale=Math.min(1,1600/Math.max(width,height)),canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext("2d");if(!ctx){bitmap.close();throw new Error("Não foi possível preparar a imagem.");}
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  let blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));
  if(!blob||blob.size>1048576){ctx.globalCompositeOperation="destination-over";ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);for(const quality of [.85,.65,.45,.25]){blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));if(blob&&blob.size<=1048576)break;}}
  canvas.width=canvas.height=0;if(!blob||blob.size>1048576)throw new Error("A imagem ainda está grande. Escolha uma versão menor.");
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
  try{const response=await fetch("/api/media",{method:"POST",credentials:"same-origin",headers:{"Content-Type":blob.type},body:blob,signal:controller.signal});const data=await response.json() as {url:string;error?:string};if(!response.ok)throw new Error(data.error||"Não foi possível guardar a imagem.");return {url:data.url,width,height};}
  catch(e){if((e as Error).name==="AbortError")throw new Error("O envio demorou mais que o esperado. Tente novamente.");throw e;}
  finally{clearTimeout(timeout);}
}
