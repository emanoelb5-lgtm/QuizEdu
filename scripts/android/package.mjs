import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {androidVersion} from "./version.mjs";
const apk="android/app/build/outputs/apk/direct/release/app-direct-release.apk";
const aab="android/app/build/outputs/bundle/playRelease/app-play-release.aab";
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:"utf8"});if(r.status!==0)throw new Error(`Verification failed: ${cmd}`);return r.stdout;}
for(const p of [apk,aab])if(!fs.existsSync(p))throw new Error("Signed distribution file missing.");
const verifier=path.join(process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT,"build-tools/35.0.0/apksigner");
const verified=run(verifier,["verify","--verbose","--print-certs",apk]);
const certificate=verified.match(/Signer #1 certificate SHA-256 digest:\s*([a-f0-9]+)/i)?.[1]?.toLowerCase();
if(certificate!==process.env.QUIZEDU_CERT_SHA256)throw new Error("APK signed with an unexpected certificate.");
const checked=run("jarsigner",["-verify",aab]);if(!/jar verified/i.test(checked))throw new Error("AAB signature missing.");
const certText=run("keytool",["-printcert","-jarfile",aab]);const bundleCertificate=certText.match(/SHA256:\s*([A-F0-9:]+)/i)?.[1]?.replaceAll(":","").toLowerCase();
if(bundleCertificate!==certificate)throw new Error("AAB and APK have different signing certificates.");
const bundletool="/tmp/prativerso-bundletool.jar";
run("java",["-jar",bundletool,"validate",`--bundle=${aab}`]);
const manifest=run("java",["-jar",bundletool,"dump","manifest",`--bundle=${aab}`,"--module=base"]);
for(const expected of ['package="br.com.quizedu.app"','android:targetSdkVersion="36"','android:minSdkVersion="24"'])if(!manifest.includes(expected))throw new Error("Unexpected Play manifest: "+expected);
run(path.join(process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT,"build-tools/35.0.0/zipalign"),["-c","-P","16","4",apk]);
const libraries=run("unzip",["-Z1",aab]).split("\n").filter(p=>p.endsWith(".so"));
for(const entry of libraries.filter(p=>/arm64-v8a|x86_64/.test(p))){
 const result=spawnSync("unzip",["-p",aab,entry]);if(result.status!==0)throw new Error("Missing ELF library");const elf=result.stdout;
 if(elf.readUInt32BE(0)!==0x7f454c46||elf[4]!==2||elf[5]!==1)throw new Error("Unsupported ELF layout");
 const offset=Number(elf.readBigUInt64LE(32)),size=elf.readUInt16LE(54),count=elf.readUInt16LE(56);
 for(let i=0;i<count;i++){const p=offset+i*size;if(elf.readUInt32LE(p)===1&&elf.readBigUInt64LE(p+48)<16384n)throw new Error("ELF needs 16 KB alignment: "+entry);}
}
const pageCheck=libraries.length?`Bibliotecas ELF de 64 bits alinhadas para 16 KB (${libraries.length} arquivos .so); APK com zipalign -P 16 aprovado.`:"Sem bibliotecas .so; não requer ajuste ELF para páginas de 16 KB.";
fs.mkdirSync("release-assets",{recursive:true});const version=androidVersion();let sums="";
for(const [source,name] of [[apk,`Prativerso-Android-${version}.apk`],[aab,`Prativerso-Google-Play-${version}.aab`]]){
 const data=fs.readFileSync(source);fs.writeFileSync("release-assets/"+name,data);sums+=createHash("sha256").update(data).digest("hex")+"  "+name+"\n";
}
const certificatePem=run("keytool",["-printcert","-rfc","-jarfile",aab]);fs.writeFileSync("release-assets/certificado-upload.pem",certificatePem);
fs.writeFileSync("release-assets/VERIFICACOES.txt",`Prativerso ${version}\nPacote: br.com.quizedu.app\nAndroid mínimo: 7.0 (API 24)\nAndroid alvo: 16 (API 36)\nVersionCode: ${10000+Number(process.env.QUIZEDU_BUILD_NUMBER)}\nSHA-256 do certificado: ${certificate}\nAPK: apksigner verify aprovado, mesma chave existente.\nAAB: jarsigner verify e bundletool validate aprovados.\n${pageCheck}\nPlay: atualizações pela Google Play; sem download de APK no aplicativo.\nA chave de assinatura privada NÃO está incluída.\n`);
for(const entry of fs.readdirSync("android/play-store")){
 const source=path.join("android/play-store",entry);if(fs.statSync(source).isFile())fs.copyFileSync(source,path.join("release-assets",entry));
}
const screenshots="android/store-screenshots";
if(fs.existsSync(screenshots))fs.cpSync(screenshots,"release-assets/screenshots",{recursive:true});
const zipName=`Prativerso-Publicacao-Google-Play-${version}.zip`;
run("python3",["-c","import pathlib,zipfile,sys\nr=pathlib.Path('release-assets')\nwith zipfile.ZipFile(r/sys.argv[1],'w',zipfile.ZIP_DEFLATED) as z:\n for p in sorted(r.rglob('*')):\n  if p.is_file() and p.name != sys.argv[1]: z.write(p,p.relative_to(r))",zipName]);
const zip=fs.readFileSync("release-assets/"+zipName);sums+=createHash("sha256").update(zip).digest("hex")+"  "+zipName+"\n";fs.writeFileSync("release-assets/SHA256SUMS.txt",sums);
console.log("APK e AAB assinados, validados; pacote de publicação preparado.");
