const CACHE_NAME = 'testlab-linkbook-shell-v1';
const PRECACHE = ['', 'index.html', 'styles.css', 'app.js', 'db.js', 'metadata.js', 'cover.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const scope = self.registration.scope;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache => cache.addAll(PRECACHE.map(p => new URL(p, scope).href)))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('testlab-linkbook-') && key !== CACHE_NAME).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(scope)) return;
  // Network first keeps GitHub Pages updates visible even when the service worker source is unchanged.
  // On failure, use cached assets. Shared URLs (query string) fall back to the cached app shell.
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && request.mode !== 'navigate') {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
      }
      return response;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(request) ||
        (request.mode === 'navigate' ? await cache.match(new URL('index.html', scope).href) : null) ||
        Response.error();
    }
  })());
});
