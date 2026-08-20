const CACHE = 'alhashd-v3';
const ASSETS = [
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

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  if (url.pathname.includes('content.json')) {
    e.respondWith(fetch(request, { cache: 'no-store' }).catch(() =>
      new Response('{"version":"3.0.0.0","sections":[],"announcements":[]}', { headers: { 'Content-Type': 'application/json' } })
    ));
    return;
  }

  if (request.method !== 'GET') return;

  if (request.url.match(/\.(jpg|jpeg|png|gif|webp|mp4|mp3|webm|ogg)$/)) {
    e.respondWith(caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(r => { const clone = r.clone(); caches.open(CACHE).then(c => c.put(request, clone)); return r; }).catch(() => cached);
    }));
    return;
  }

  e.respondWith(fetch(request).then(r => {
    const clone = r.clone();
    caches.open(CACHE).then(c => c.put(request, clone));
    return r;
  }).catch(() => caches.match(request).then(c => {
    if (c) return c;
    if (request.mode === 'navigate') return caches.match('/al-hashd-fatimi/index.html');
    return new Response('Offline', { status: 503 });
  })));
});
