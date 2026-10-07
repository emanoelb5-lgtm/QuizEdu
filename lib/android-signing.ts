import {env} from "cloudflare:workers";
import {HttpError,json} from "./server";

// The private signing bundle is a Sites secret. Only this repository's trusted
// main-branch Actions workflow may retrieve it, using a short-lived GitHub JWT.
// No personal token, signing key or password is committed or logged.
const issuer="https://token.actions.githubusercontent.com";
export const signingAudience="https://quizedu-emanuel.emanuelb5.chatgpt.site/api/android/signing";
const repository="emanoelb5-lgtm/QuizEdu",repositoryId="1407486285",ownerId="305669201";
const workflow=`${repository}/.github/workflows/android.yml@refs/heads/main`;
export function trustedSigningClaims(c:Record<string,unknown>,now=Math.floor(Date.now()/1000)){
 const subjects=[`repo:${repository}:ref:refs/heads/main`,`repo:emanoelb5-lgtm@${ownerId}/QuizEdu@${repositoryId}:ref:refs/heads/main`];
 // GitHub now includes job_workflow_ref for ordinary jobs too. If present it
 // must identify this same trusted workflow; other reusable workflows fail.
 return c.iss===issuer&&c.aud===signingAudience&&typeof c.sub==="string"&&subjects.includes(c.sub)&&c.repository===repository&&c.repository_id===repositoryId&&c.repository_owner_id===ownerId&&c.ref==="refs/heads/main"&&c.ref_type==="branch"&&["push","workflow_dispatch"].includes(String(c.event_name))&&c.workflow_ref===workflow&&c.runner_environment==="github-hosted"&&(c.job_workflow_ref===undefined||c.job_workflow_ref===workflow)&&typeof c.exp==="number"&&c.exp>now&&c.exp<=now+900&&typeof c.iat==="number"&&c.iat<=now+30&&c.iat>=now-600&&typeof c.nbf==="number"&&c.nbf<=now+30;
}
function decode(value:string){return Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));}
let jwks:{expires:number;keys:(JsonWebKey&{kid?:string;use?:string;alg?:string})[]}|undefined;
export async function androidSigning(request:Request){
 const token=request.headers.get("Authorization")?.match(/^Bearer ([\w.-]+)$/)?.[1];
 if(!token||token.length>16000)throw new HttpError(401,"GitHub Actions authentication required.");
 let parts:string[],header:Record<string,unknown>,claims:Record<string,unknown>;
 try{parts=token.split(".");if(parts.length!==3)throw new Error();header=JSON.parse(new TextDecoder().decode(decode(parts[0])));claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));}catch{throw new HttpError(401,"Invalid Actions token.");}
 if(header.alg!=="RS256"||header.typ!=="JWT"||typeof header.kid!=="string"||!trustedSigningClaims(claims))throw new HttpError(403,"This workflow is not authorized to sign QuizEdu.");
 if(!jwks||jwks.expires<Date.now()||!jwks.keys.some(k=>k.kid===header.kid)){
   const response=await fetch(`${issuer}/.well-known/jwks`,{signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new HttpError(503,"GitHub signing identity unavailable.");
   const document=await response.json() as {keys:JsonWebKey[]};if(!Array.isArray(document.keys)||document.keys.length>30)throw new HttpError(503,"Invalid GitHub keyset.");
   jwks={keys:document.keys,expires:Date.now()+3600000};
 }
 const key=jwks.keys.find(k=>k.kid===header.kid&&k.kty==="RSA"&&k.use==="sig"&&k.alg==="RS256");if(!key)throw new HttpError(401,"Unknown Actions signing identity.");
 const imported=await crypto.subtle.importKey("jwk",key,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",imported,decode(parts[2]),new TextEncoder().encode(parts.slice(0,2).join("."))))throw new HttpError(401,"Invalid Actions signature.");
 const bundle=(env as unknown as Record<string,unknown>).ANDROID_SIGNING_BUNDLE;
 if(typeof bundle!=="string"||bundle.length>30000)throw new HttpError(503,"QuizEdu signing is not configured.");
 return json(JSON.parse(bundle));
}
