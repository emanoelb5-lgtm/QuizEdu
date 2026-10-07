import fs from "node:fs";
import path from "node:path";

// OIDC is scoped server-side to this immutable repository/owner, this workflow,
// main, GitHub-hosted runners and push/workflow_dispatch. PRs cannot sign.
const audience = "https://quizedu-emanuel.emanuelb5.chatgpt.site/api/android/signing";
const mask = value => process.stdout.write("::add-mask::" + value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A") + "\n");
const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if (!requestUrl || !requestToken || !process.env.GITHUB_ENV || !process.env.RUNNER_TEMP) throw new Error("Run signing from the trusted GitHub Actions workflow.");
const oidcUrl = new URL(requestUrl); oidcUrl.searchParams.set("audience", audience);
const oidcResponse = await fetch(oidcUrl, {headers: {Authorization: "Bearer " + requestToken}});
if (!oidcResponse.ok) throw new Error("GitHub OIDC authentication failed: " + oidcResponse.status);
const {value: jwt} = await oidcResponse.json(); mask(jwt);
const response = await fetch(audience, {method:"POST", headers:{Authorization:"Bearer " + jwt}});
if (!response.ok) throw new Error("QuizEdu signing service rejected this build: " + response.status);
const bundle = await response.json();
for (const key of ["keystore", "storePassword", "keyPassword"]) {
  if (typeof bundle[key] !== "string" || !bundle[key]) throw new Error("Incomplete private signing bundle.");
  mask(bundle[key]);
}
if (!/^[a-f0-9]{64}$/.test(bundle.certificateSha256) || !/^[a-zA-Z0-9_-]+$/.test(bundle.keyAlias)) throw new Error("Invalid signing certificate.");
const directory = path.join(process.env.RUNNER_TEMP, "quizedu-signing");
fs.mkdirSync(directory, {recursive:true, mode:0o700});
const keystore = path.join(directory, "quizedu.p12");
fs.writeFileSync(keystore, Buffer.from(bundle.keystore, "base64"), {mode:0o600});
const values = {QUIZEDU_KEYSTORE:keystore,QUIZEDU_STORE_PASSWORD:bundle.storePassword,QUIZEDU_KEY_PASSWORD:bundle.keyPassword,QUIZEDU_KEY_ALIAS:bundle.keyAlias,QUIZEDU_CERT_SHA256:bundle.certificateSha256};
for (const value of Object.values(values)) if (value.includes("\n") || value.includes("\r")) throw new Error("Invalid signing value.");
fs.appendFileSync(process.env.GITHUB_ENV, Object.entries(values).map(([key,value])=>key+"="+value).join("\n")+"\n");
console.log("Assinatura privada preparada para este build. Certificado SHA-256: " + bundle.certificateSha256);
