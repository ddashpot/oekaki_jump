const CACHE = "oekaki-jump-v8-1-hybrid-transfer-fix";
const ASSETS = [
  "./","./index.html","./settings.html","./style.css","./screen.css","./app.js","./settings.js","./oekaki-jump.png",
  "./assets/motions/jump.png",
  "./assets/motions/sway.png",
  "./assets/motions/float.png",
  "./assets/motions/rotate.png",
  "./assets/motions/shake.png",
  "./assets/motions/squash.png",
  "./manifest.json","./icon-192.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        ASSETS.map(url =>
          fetch(url, {cache:"no-cache"})
            .then(response => response.ok ? cache.put(url, response) : null)
            .catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
