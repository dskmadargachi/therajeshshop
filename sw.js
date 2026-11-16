/* therajesh.shop service worker (v12) — shows shop notifications as system banners.
   The page polls /api/notifications and hands new messages to this worker; real server-side Web Push
   (site closed) would additionally need VAPID keys, which this lightweight version does not use. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type !== 'show') return;
  e.waitUntil(self.registration.showNotification(d.title || 'therajesh.shop', {
    body: d.body || '',
    tag: d.tag || 'shop-' + Date.now(),
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    lang: d.lang || 'en',
    data: { url: d.url || '/' },
    vibrate: [120, 60, 120],
  }));
});

/* real push payloads (optional, if a push service is wired up later) */
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'therajesh.shop', { body: d.body || '', icon: '/icon-192.png', badge: '/favicon-32.png', data: { url: d.url || '/' } }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.postMessage({ type: 'open-inbox' }); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
