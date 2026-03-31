const CACHE_VERSION = "backblog-static-v2";
const ASSET_PATHS = ["/favicon.ico", "/manifest.json", "/icon-192.png", "/icon-512.png"];
const CACHEABLE_DESTINATIONS = ["style", "script", "font", "image"];

self.addEventListener("install", (event) => {
  const assetsToCache = ASSET_PATHS;

  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(assetsToCache)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const request = event.request;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/_next/")) {
    return; // let Next handle its own cache strategy
  }

  const isDocumentRequest = request.mode === "navigate" || request.destination === "document";
  if (isDocumentRequest) {
    return; // always hit network for HTML/navigation requests
  }

  if (!CACHEABLE_DESTINATIONS.includes(request.destination)) {
    return; // don't cache API calls or other dynamic resources
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          cache.put(request, cloned);
        });
        return response;
      });
    }),
  );
});
