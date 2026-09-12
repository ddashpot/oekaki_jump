// v9.1.3 migration worker: remove old app caches and unregister itself.
const PREFIX = "oekaki-jump-";
self.addEventListener("install", event => { self.skipWaiting(); });
self.addEventListener("activate", event => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(PREFIX)).map(k => caches.delete(k)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request, {cache:"no-store"}));
});
