const CACHE_NAME = 'al-hashd-fatimi-v3';
const STATIC_ASSETS = [
  '/al-hashd-fatimi/',
  '/al-hashd-fatimi/index.html',
  '/al-hashd-fatimi/admin.html',
  '/al-hashd-fatimi/css/style.css',
  '/al-hashd-fatimi/js/app.js',
  '/al-hashd-fatimi/js/db.js',
  '/al-hashd-fatimi/js/admin.js',
  '/al-hashd-fatimi/manifest.json',
  '/al-hashd-fatimi/icons/icon-192x192.png',
  '/al-hashd-fatimi/icons/icon-512x512.png'
];

const NEVER_CACHE = ['/al-hashd-fatimi/content.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (NEVER_CACHE.some(path => url.pathname.includes(path))) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => {
        return new Response('{"sections":[],"announcements":[]}', {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  if (request.method !== 'GET') return;

  if (request.url.match(/\.(jpg|jpeg|png|gif|webp|mp4|mp3|webm|ogg)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).then((response) => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      return response;
    }).catch(() => {
      return caches.match(request).then((cached) => {
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return caches.match('/al-hashd-fatimi/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
