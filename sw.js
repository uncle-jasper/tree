const CACHE = 'tree-v47';
const ASSETS = ['/tree/', '/tree/index.html', '/tree/manifest.json', '/tree/icon.svg',
  '/tree/spell.js', '/tree/spell-words.txt', '/tree/packs.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // The pack shelf lives on this same origin (/tree-packs/). Caching it
  // cache-first froze its index.json, so packs added to the shelf later
  // never showed. Other apps' paths on this origin go to the network.
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin && !url.pathname.startsWith('/tree/')) return;

  // Network-first for HTML so deploys are visible immediately
  const isHTML = e.request.destination === 'document' ||
    e.request.url.endsWith('/tree/') ||
    e.request.url.endsWith('/tree/index.html');

  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for all other assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/tree/index.html'));
    })
  );
});
