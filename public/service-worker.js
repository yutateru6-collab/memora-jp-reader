const CACHE_NAME = 'memora-jp-reader-shell-v1';
const urlsToCache = ['/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Always prefer the network for navigations. The previous cache-first shell
  // could keep an old bundle alive on installed iPhones after a deployment.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const responseToCache = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME)
                .then(cache => cache.put('/index.html', responseToCache))
            );
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Vite assets are content-hashed, so cache-first is safe for same-origin
  // static files. Leave third-party responses to the browser/network.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();

            const contentType = networkResponse.headers.get('content-type');
            if (contentType && (contentType.startsWith('audio/') || contentType.startsWith('video/'))) {
              return networkResponse;
            }

            event.waitUntil(
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseToCache))
            );

            return networkResponse;
          }
        );
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
          return undefined;
        })
      ))
      .then(() => self.clients.claim())
  );
});
