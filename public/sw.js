/* Teacher Toolkit — PWA Service Worker
   App shell cache: baar baar kholne par foran khulta hai, weak internet par bhi.
   API/generation routes hamesha network se (fresh data). */
/* v5: fixes a real bug — the app-shell branch below used to cache EVERY network response
   including error pages (404/500). Once an error response got cached (e.g. during a bad deploy,
   or a route that didn't exist yet), any later network hiccup would fall back to that cached
   error FOREVER, even after the live server was long since fixed. Bumping the cache name here
   forces every existing install to drop whatever it has cached and start clean. */
const CACHE = 'tt-shell-v5';
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
  // API + SEO/meta routes: kabhi cache nahi — bots (Googlebot etc.) don't run service workers
  // anyway, and these must always reflect the live server, never a stale local copy.
  if (/^\/(generate|download|auth|wallet|admin|students-sync|verify|books|config|version|upload|documents|stats|sitemap\.xml|robots\.txt)/.test(url.pathname)) return;
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
  // App shell: network-first, offline par cache — only cache successful responses (res.ok),
  // never an error page, so a transient 404/500 can't get "stuck" and resurface later.
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('/')))
  );
});
