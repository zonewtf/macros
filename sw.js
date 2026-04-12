const VERSION = 'v5'; // <--- C'est le SEUL endroit à MAJ
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

// Installation : on met en cache les fichiers
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Nettoyage : on supprime les vieux caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Stratégie de Fetch : Stale-While-Revalidate
self.addEventListener('fetch', e => {
  // On ignore ce qui ne vient pas de notre site (sauf OpenFoodFacts)
  if (!e.request.url.startsWith(self.location.origin) && !e.request.url.includes('openfoodfacts.org')) return;

  if (e.request.url.includes('openfoodfacts.org')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}')));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      const fetchPromise = fetch(e.request).then(networkResponse => {
        // On met à jour le cache en fond
        if (networkResponse.ok) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, cacheCopy));
        }
        return networkResponse;
      });
      // On renvoie le cache s'il existe, sinon on attend le réseau
      return cachedResponse || fetchPromise;
    })
  );
});