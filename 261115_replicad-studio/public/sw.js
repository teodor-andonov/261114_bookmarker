// Offline shell and runtime cache for this prototype only (never caches model data).
const CACHE = "testlab-replicad-studio-v1";
const scopeURL = new URL(self.registration.scope);
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["./", "./index.html"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("testlab-replicad-studio-") && k !== CACHE).map(k => caches.delete(k)))),self.clients.claim()]));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scopeURL.origin || !url.pathname.startsWith(scopeURL.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    try {
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch (err) {
      if (cached) return cached;
      throw err;
    }
  })());
});
