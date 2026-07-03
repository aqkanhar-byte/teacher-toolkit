/* Teacher Toolkit — PWA Service Worker
   App shell cache: baar baar kholne par foran khulta hai, weak internet par bhi.
   API/generation routes hamesha network se (fresh data). */
const CACHE = 'tt-shell-v3';
const SHELL = ['/', '/index.html', '/shared-data.js', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // API routes: kabhi cache nahi
  if (/^\/(generate|download|auth|wallet|admin|students-sync|verify|books|config|version|upload|documents)/.test(url.pathname)) return;
  // Fonts/CDN libs: cache-first (offline bhi chalein)
  if (url.origin !== location.origin) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      try { const res = await fetch(e.request); if (res.ok) c.put(e.request, res.clone()); return res; }
      catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  // App shell: network-first, offline par cache
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('/')))
  );
});
