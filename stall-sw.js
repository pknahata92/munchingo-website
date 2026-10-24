// Offline copy of the stall tally only (registered with scope /stall). Network first, cached copy when offline.
// Bump the version together with stall.js?v= in stall.html and StallTally.version in js/stall.js.
const CACHE = 'munchingo-stall-v2';
const FILES = ['/stall', '/js/stall.js?v=2'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('munchingo-stall-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname !== '/stall' && u.pathname !== '/stall.html' && u.pathname !== '/js/stall.js') return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then((m) => m || caches.match('/stall'))));
});
