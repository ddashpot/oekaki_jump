const CACHE = "oekaki-jump-pages-v1";
const BASE = new URL("./", self.location.href);
const ASSETS = [
  new URL("./", BASE).href,
  new URL("index.html", BASE).href,
  new URL("style.css", BASE).href,
  new URL("app.js", BASE).href,
  new URL("manifest.webmanifest", BASE).href,
  new URL("icon-192.png", BASE).href,
  new URL("icon-512.png", BASE).href
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
    )
  );
});
