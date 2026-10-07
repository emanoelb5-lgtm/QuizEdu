/* Only public assets are cached. Live rooms, answers, profiles and sign-in
   always use the network; offline navigation preserves the route to retry. */
const CACHE = "quizedu-player-v1";
const SHELL = ["/offline.html", "/favicon.svg", "/app-icon-192.png", "/app-icon-512.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("quizedu-player-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.includes("signin-with-chatgpt") || url.pathname.includes("signout-with-chatgpt") || url.pathname === "/callback") return;
  if (request.mode === "navigate" && (url.pathname === "/jogar" || /^\/participar\/\d{6}\/?$/.test(url.pathname))) {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) || new Response("Sem conexão. Reabra o QuizEdu quando a internet voltar.",{status:503,headers:{"Content-Type":"text/plain;charset=utf-8"}})));
    return;
  }
  const asset = SHELL.includes(url.pathname) || (/^\/assets\/.+\.[a-z0-9]+$/i.test(url.pathname) && ["script","style","font"].includes(request.destination));
  if (!asset || url.search) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request); if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type !== "opaque") {
      await cache.put(request,response.clone()); const keys = await cache.keys();
      if (keys.length > 90) for (const key of keys) {if (!SHELL.includes(new URL(key.url).pathname)) {await cache.delete(key);break;}}
    }
    return response;
  }));
});
