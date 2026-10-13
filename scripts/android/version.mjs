import fs from "node:fs";
import {pathToFileURL} from "node:url";
export function androidVersion(){
  const source=fs.readFileSync("android/app/build.gradle.kts","utf8");
  const version=source.match(/versionName\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"/)?.[1];
  if(!version)throw new Error("Android versionName missing or invalid.");
  return version;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const version=androidVersion();
  console.log(`version=${version}\napk=Prativerso-Android-${version}.apk`);
}
