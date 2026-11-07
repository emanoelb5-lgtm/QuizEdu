const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const project = process.env.CLOUDFLARE_PAGES_PROJECT || "prativerso";
const commit = process.env.GITHUB_SHA;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token || !/^[a-f0-9]{40}$/.test(commit || "")) throw new Error("Missing Cloudflare deployment configuration.");
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${encodeURIComponent(project)}`;
let deployment;
for (let attempt = 0; attempt < 20; attempt++) {
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Cloudflare deployment verification returned HTTP ${response.status}.`);
  const result = await response.json();
  if (!result.success) throw new Error("Cloudflare did not confirm the deployment.");
  const current = result.result.canonical_deployment;
  if (current?.deployment_trigger?.metadata?.commit_hash === commit && current.latest_stage?.status === "success") { deployment = current; break; }
  await new Promise(resolve => setTimeout(resolve, 3000));
}
if (!deployment) throw new Error("The production deployment does not match this GitHub commit.");
const origin = "https://prativerso.b5solucoes.online";
for (const route of ["/entrar", "/api/ping", "/api/lessons"]) {
  const response = await fetch(origin + route, { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(15000) });
  if (response.status !== 200) throw new Error(`Production check ${route} returned HTTP ${response.status}.`);
  if (route === "/entrar") {
    const html = await response.text();
    if (!html.includes("Prativerso") || !html.includes("Criar conta")) throw new Error("The login page did not render correctly.");
  } else {
    const data = await response.json();
    if (route === "/api/ping" && !Number.isFinite(data.serverNow)) throw new Error("The production API did not respond correctly.");
    if (route === "/api/lessons" && !Array.isArray(data.lessons)) throw new Error("The production lesson catalog is unavailable.");
  }
}
console.log(JSON.stringify({ published: true, commit, deployment: deployment.id, url: origin }));
