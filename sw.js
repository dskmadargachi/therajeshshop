/* sw.js — lightweight cache-first Service Worker for STATIC assets only.
   Cached: site-theme.css, wizard.css, site-ui.js, wizard.js, scan-wizard.js, voice-alerts.js, p2p.js, p2p-counter.js, icons, /sounds/*
   Never touched: /api/*, HTML pages, other origins, non-GET requests (they go straight to the network as before).

   ► On every deploy that changes one of these files, bump VERSION below (old caches are deleted on activate).
     As a safety net, a cached file older than MAX_AGE_MS is re-fetched even if VERSION was forgotten. */
const VERSION = 'v1';
const CACHE = 'rajesh-static-' + VERSION;
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const STATIC = /^\/(site-theme\.css|wizard\.css|site-ui\.js|wizard\.js|scan-wizard\.js|voice-alerts\.js|p2p\.js|p2p-counter\.js|icon-192\.png|icon-512\.png|apple-touch-icon\.png|favicon(-32)?\.(png|ico)|sounds\/.+)$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('rajesh-static-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const fresh = (res) => Date.now() - Number(res.headers.get('x-sw-cached-at') || 0) < MAX_AGE_MS;

async function store(cache, key, res) {            // keep a timestamp so very old entries can be refreshed
  const h = new Headers(res.headers); h.set('x-sw-cached-at', String(Date.now()));
  const blob = await res.clone().blob();
  const make = () => new Response(blob, { status: res.status, statusText: res.statusText, headers: h });
  await cache.put(key, make());                      // cache.put consumes its Response, so the caller gets its own copy
  return make();
}

/* audio/video elements (Safari always) ask for byte ranges: answer them from the full cached file */
async function rangeFrom(req, res) {
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (!m) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  let a = m[1] === '' ? size - Number(m[2]) : Number(m[1]), b = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (!(a >= 0 && a <= b)) return new Response(null, { status: 416, headers: { 'content-range': 'bytes */' + size } });
  return new Response(buf.slice(a, b + 1), { status: 206, headers: { 'content-type': res.headers.get('content-type') || 'application/octet-stream',
    'content-range': 'bytes ' + a + '-' + b + '/' + size, 'content-length': String(b - a + 1) } });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !STATIC.test(url.pathname)) return;      // everything else: normal network
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = url.origin + url.pathname + url.search;                                 // ?v=7 style cache-busting still works
    const hit = await cache.match(key);
    if (hit && fresh(hit)) return req.headers.has('range') ? rangeFrom(req, hit) : hit;
    try {
      const net = await fetch(key, { cache: 'reload' });                                // full file, never a partial 206
      if (net.status === 200) { const saved = await store(cache, key, net); return req.headers.has('range') ? rangeFrom(req, saved) : net; }
      return hit || net;
    } catch (err) {
      if (hit) return req.headers.has('range') ? rangeFrom(req, hit) : hit;             // offline / network error: stale beats nothing
      throw err;
    }
  })());
});
