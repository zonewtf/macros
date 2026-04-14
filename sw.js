const VERSION = 'v19';
const CACHE = `macros-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './foods.csv',
  './icons/icon.svg'
];

// Installation : on force l'activation
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Nettoyage et prise de contrôle immédiate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Stratégie Stale-While-Revalidate (inchangée mais propre)
self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin) && !e.request.url.includes('openfoodfacts.org')) return;
  if (e.request.url.includes('openfoodfacts.org')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      const fetchPromise = fetch(e.request).then(networkResponse => {
        if (networkResponse.ok) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, cacheCopy));
        }
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});