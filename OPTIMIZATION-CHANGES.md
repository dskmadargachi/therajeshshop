# Worker-invocation optimizations (v14)

1. _worker.js   public GETs (whatsapp-status, config, admin-config) -> `Cache-Control: public, max-age=15, s-maxage=15`
                + Cache API (edgeCached) so repeats inside 15 s skip D1/KV. Failed health probes are never cached. /api/orders/:id stays no-store.
2. site-ui.js   WhatsApp badge: interval cleared the moment the tab is hidden, restarted on visible; result cached 30 s in sessionStorage; cache-buster removed.
   counter.html load()/loadVisitors()/startPolling() refuse to run while hidden; admin-config cached 30 s in sessionStorage; P2P arrivals don't trigger a server call while hidden.
   index.html / cards.html order-status poll waits while the tab is hidden and resumes instantly when shown.
3. Batching     audited: every multi-file path already sends ONE request (index.html -> one /api/orders FormData, P2P -> one connection, counter manual upload -> one call). No merging added.
4. sw.js        cache-first for the listed static assets (+ p2p.js, p2p-counter.js). Registered from site-ui.js. BUMP `VERSION` in sw.js on every deploy that changes those files.
5. _routes.json (Cloudflare Pages) only /api/* and / invoke the worker; static files no longer do. Delete the file to revert.
