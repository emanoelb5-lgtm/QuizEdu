import {cpSync,mkdirSync} from "node:fs";
import path from "node:path";
const root=path.resolve("node_modules/pdfjs-dist");
mkdirSync("public/pdf-assets",{recursive:true});
cpSync(path.join(root,"build/pdf.worker.min.mjs"),"public/pdf.worker.min.mjs");
for(const folder of ["wasm","standard_fonts","cmaps"])cpSync(path.join(root,folder),path.join("public/pdf-assets",folder),{recursive:true});
