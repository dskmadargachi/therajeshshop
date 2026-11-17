/* =====================================================================================================================
   p2p.js — direct browser -> counter file transfer over a WebRTC DataChannel (PeerJS). NO Cloudflare Worker involved.

   Customer pages call:
       P2P.submit({ files:[File], meta:{...same meta the /api/orders upload uses...}, cfg, btn, fallback: () => post(fd) })
   -> resolves a { id, amount, status, p2p:true, via:'p2p' }  object when the counter ACKs the order, or whatever
      `fallback()` resolves (the existing /api/orders upload) when P2P cannot be used. The files are already in memory,
      so the customer never has to pick them again.

   Wire protocol (PeerJS "binary" serialization, one DataConnection per order, counter peer id below):
       sender -> counter   { t:'meta',  orderId, transferId, idx, fileCount, fileName, mimeType, fileSize, totalChunks, customerName, printOptions }
                           { t:'chunk', transferId, i, data:ArrayBuffer(<=32768) }
                           { t:'end',   transferId }
       counter -> sender   { t:'ack',   transferId }                      (one file fully received + verified)
                           { t:'order', orderId, amount, status }          (whole order is now in the counter queue  => ACK)
                           { t:'nack',  transferId, error }                (counter refused it -> sender falls back to the server)
   Also used by the counter page: P2P.loadPeer(), P2P.estimate(), P2P.COUNTER_ID, P2P.ICE, P2P.CHUNK.

   LIVE ORDER SESSION (new): after the counter ACKs, the DataConnection STAYS OPEN so the customer gets exactly the same live order
   tracker as a normal upload (Upload -> Pay -> Print -> Delete from PC -> Delete from server):
       counter -> sender   { t:'status', orderId, status, pay_status, pay_method, amount, pc_deleted, srv_deleted, note, pages }   (pushed on every change)
                           { t:'gone',   orderId }                                                                                  (counter does not know the order)
       sender -> counter   { t:'get',    orderId }                       ask for the current status (also used after a reconnect)
                           { t:'pay',    orderId, method:'counter' }     customer pressed "Pay at Counter"
                           { t:'paying', orderId }                       customer opened Razorpay (counter starts checking the server for the payment)
                           { t:'paid',   orderId, paymentId }            customer finished Razorpay (counter VERIFIES it with GET /api/p2p/pay-status/:id)
   The existing page code keeps calling  fetch('/api/orders/<id>')  /  fetch('/api/create-order')  /  fetch('/api/verify-payment');  a tiny fetch
   shim below answers those calls for ids that start with "P2P-" (status comes from the counter, payment goes through the Worker), so the
   upload animation, tracker and status transitions are identical for server and P2P orders. Everything else passes straight through.
   ===================================================================================================================== */
(function () {
  if (window.P2P) return;

  var COUNTER_ID = 'therajeshshop-counter-main';
  var CHUNK = 32768;                       // 32 KB per DataChannel message
  var CONNECT_MS = 4000;                   // peer + connection must be open within 4 s, otherwise -> server fallback
  var ACK_MS = 30000;                      // after the last chunk the counter must confirm within 30 s
  var HIGH_WATER = 1024 * 1024;            // pause sending while > 1 MB is queued in the DataChannel
  var ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  var CDN = [
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'
  ];

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------- PeerJS loader (jsDelivr first, unpkg second), cached ---------- */
  var peerP = null;
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (peerP) return peerP;
    peerP = new Promise(function (ok, no) {
      var i = 0;
      (function next() {
        if (window.Peer) return ok();
        if (i >= CDN.length) { peerP = null; return no(new Error('PeerJS could not be loaded')); }
        var s = document.createElement('script');
        s.src = CDN[i++]; s.async = true; s.crossOrigin = 'anonymous';
        s.onload = function () { window.Peer ? ok() : next(); };
        s.onerror = function () { try { s.remove(); } catch (e) {} next(); };
        document.head.appendChild(s);
      })();
    });
    return peerP;
  }
  /* download PeerJS in the background so the 4-second connect budget is not spent on the script itself */
  function warm() { try { loadPeer().catch(function () {}); } catch (e) {} }

  /* ---------- price estimate (same formula as _worker.js createOrder; the counter recomputes it authoritatively) ---------- */
  function estimate(meta, cfg) {
    meta = meta || {}; cfg = cfg || {};
    var r = cfg.rate || {}, pp = cfg.passport || {};
    var bw = +r.bw || 5, col = +r.color || 10, a3 = +cfg.a3 || 2, ph = +cfg.photo4x6 || 20;
    var kind = meta.kind === 'passport' ? 'passport' : 'doc';
    var paper = ['A4', 'A3', '4x6'].indexOf(meta.paper) >= 0 ? meta.paper : 'A4';
    var color = (meta.color || paper === '4x6' || kind === 'passport') ? 1 : 0;
    var copies = Math.min(Math.max(parseInt(meta.copies) || 1, 1), kind === 'passport' ? 20 : 100);
    var pages = (Array.isArray(meta.pages) && meta.pages.length ? meta.pages : [1]).reduce(function (s, n) { return s + Math.min(Math.max(parseInt(n) || 1, 1), 2000); }, 0);
    var amt;
    if (kind === 'passport') amt = copies * (paper === '4x6' ? (+pp['4x6'] || 30) : (+pp.A4 || 50));
    else if (paper === '4x6') amt = pages * copies * ph;
    else amt = pages * copies * (color ? col : bw) * (paper === 'A3' ? a3 : 1);
    return Math.round(amt * 100) / 100;
  }

  function newId() {
    var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(6), s = '';
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < a.length; i++) s += c[a[i] % c.length];
    return 'P2P-' + s;
  }

  /* ---------- "Direct P2P" / "Server Fallback" pill next to the send button ---------- */
  var pillCss = false;
  function pill(btn, mode) {
    try {
      if (!btn) return;
      if (!pillCss) {
        pillCss = true;
        var st = document.createElement('style');
        st.textContent = '.p2p-pill{display:block;width:max-content;max-width:100%;margin:8px auto 0;padding:4px 11px;border-radius:999px;font:700 12px/1.3 inherit;font-family:inherit;box-sizing:border-box}' +
          '.p2p-pill.try{background:#e0e7ff;color:#3730a3}.p2p-pill.p2p{background:#dcfce7;color:#166534}.p2p-pill.server{background:#fef3c7;color:#92400e}';
        document.head.appendChild(st);
      }
      var p = btn._p2pPill;
      if (!p) {
        p = btn._p2pPill = document.createElement('span');
        p.setAttribute('role', 'status');
        var bar = btn.closest ? btn.closest('.wz-act') : null;
        if (bar && bar.parentNode) bar.parentNode.insertBefore(p, bar);
        else if (btn.parentNode) btn.parentNode.insertBefore(p, btn.nextSibling);
      }
      p.className = 'p2p-pill ' + mode;
      p.textContent = mode === 'p2p' ? '⚡ Direct P2P' : mode === 'server' ? '☁️ Server Fallback' : '🔌 Connecting to counter…';
    } catch (e) {}
  }

  /* ---------- open a DataConnection to the counter, or fail within `ms` ---------- */
  function connect(ms) {
    return new Promise(function (res, rej) {
      var done = false, peer = null;
      var t = setTimeout(function () { fin(new Error('P2P connect timeout')); }, ms);
      function fin(err, conn) {
        if (done) return; done = true; clearTimeout(t);
        if (err) { try { peer && peer.destroy(); } catch (e) {} rej(err); }
        else res({ peer: peer, conn: conn });
      }
      loadPeer().then(function () {
        if (done) return;
        peer = new window.Peer({ debug: 0, config: { iceServers: ICE } });
        peer.on('error', function (e) { fin(e || new Error('peer error')); });
        peer.on('open', function () {
          var c = peer.connect(COUNTER_ID, { reliable: true, serialization: 'binary' });
          c.on('open', function () { fin(null, c); });
          c.on('error', function (e) { fin(e || new Error('connection error')); });
          c.on('close', function () { fin(new Error('connection closed')); });
        });
      }).catch(function (e) { fin(e); });
    });
  }

  /* ---------- stream the order; resolves when the counter has ACKed it, throws on ANY problem ---------- */
  async function direct(opt) {
    var files = opt.files || [], meta = opt.meta || {};
    if (!files.length) throw new Error('No files');
    var total = 0; files.forEach(function (f) { total += f.size; });
    var orderId = newId(), est = estimate(meta, opt.cfg);
    var task = window.Prog ? Prog.start('Connecting to counter…') : null;
    var link = null;
    var S = { closed: false, order: null, nack: null };
    try {
      link = await connect(CONNECT_MS);
      var conn = link.conn, dc = conn.dataChannel;
      conn.on('data', function (m) {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'order' && m.orderId === orderId) S.order = m;
        else if (m.t === 'nack') S.nack = m;
      });
      conn.on('close', function () { S.closed = true; });
      conn.on('error', function () { S.closed = true; });
      link.peer.on('disconnected', function () { /* signalling dropped; the open DataChannel keeps working */ });

      var buffered = function () { return (dc ? dc.bufferedAmount : 0) + (conn.bufferSize || 0); };
      var check = function () { if (S.nack) throw new Error(S.nack.error || 'Counter refused the file'); if (S.closed) throw new Error('P2P connection lost'); };
      var drain = async function () {
        var t0 = Date.now();
        while (buffered() > HIGH_WATER) { check(); if (Date.now() - t0 > 30000) throw new Error('P2P transfer stalled'); await sleep(20); }
      };

      if (task) task.label('Sending directly to counter…');
      var printOptions = {}; Object.keys(meta).forEach(function (k) { printOptions[k] = meta[k]; }); printOptions.estAmount = est;
      var sent = 0, lastPaint = 0;
      for (var i = 0; i < files.length; i++) {
        var f = files[i], buf = await f.arrayBuffer();
        var n = Math.max(1, Math.ceil(buf.byteLength / CHUNK)), tid = orderId + '-' + i;
        check();
        conn.send({ t: 'meta', orderId: orderId, transferId: tid, idx: i, fileCount: files.length, fileName: f.name, mimeType: f.type || 'application/octet-stream',
          fileSize: buf.byteLength, totalChunks: n, customerName: String(meta.name || ''), printOptions: printOptions });
        for (var c = 0; c < n; c++) {
          var part = buf.slice(c * CHUNK, Math.min(buf.byteLength, (c + 1) * CHUNK));
          conn.send({ t: 'chunk', transferId: tid, i: c, data: part });
          sent += part.byteLength;
          await drain();
          var now = Date.now();
          if (task && now - lastPaint > 60) { lastPaint = now; task.set(Math.min(99, Math.max(0, (sent - buffered()) / total * 100))); }
        }
        conn.send({ t: 'end', transferId: tid });
      }
      if (task) task.set(99, 'Waiting for counter…');
      var t1 = Date.now();
      while (!S.order) {
        check();
        if (Date.now() - t1 > ACK_MS) throw new Error('Counter did not confirm in time');
        await sleep(40);
      }
      if (task) (task.ok ? task.ok('Delivered to counter ✓') : task.done());
      var amt = Number(S.order.amount); if (!(amt > 0)) amt = est;
      var sess = mkSession(orderId, meta, files.length, amt, link);              // keep the connection: live status + payment choice
      wire(sess);
      return { id: orderId, amount: amt, status: 'pending', pages: sess.state.pages, files: files.length, p2p: true, via: 'p2p' };
    } catch (e) {
      if (task) task.fail();
      try { link && link.conn && link.conn.close(); } catch (x) {}
      try { link && link.peer && link.peer.destroy(); } catch (x) {}
      throw e;
    }
  }

  /* ---------- live order sessions: one per P2P order, kept open so the customer sees the counter's progress ---------- */
  var SESS = {};
  var TERMINAL = { rejected: 1, expired: 1 };
  var isP2PId = function (id) { return /^P2P-[A-Z0-9]{4,12}$/.test(String(id || '')); };
  var pagesOf = function (meta) { return (Array.isArray(meta.pages) && meta.pages.length ? meta.pages : [1]).reduce(function (s, n) { return s + Math.min(Math.max(parseInt(n) || 1, 1), 2000); }, 0); };
  var jsonRes = function (o, st) { return new Response(JSON.stringify(o), { status: st || 200, headers: { 'content-type': 'application/json' } }); };

  function mkSession(id, meta, files, est, link) {
    var color = (meta.color || meta.paper === '4x6' || meta.kind === 'passport') ? 1 : 0;
    return SESS[id] = { id: id, meta: meta, fileCount: files, link: link, waiters: [], paidLocal: false, lastGet: 0, linking: null,
      state: { id: id, status: 'pending', amount: est, copies: Math.max(parseInt(meta.copies) || 1, 1), color: color, note: '', pay_status: '', pay_method: '',
        paying: false, pages: pagesOf(meta), via: 'p2p', p2p: true, pc_deleted: 0, srv_deleted: 0 } };
  }
  function snap(sess) { var o = {}; Object.keys(sess.state).forEach(function (k) { o[k] = sess.state[k]; }); return o; }

  function onStatus(sess, m) {
    var s = sess.state;
    if (m.status) s.status = String(m.status);
    if (m.pay_status != null) s.pay_status = String(m.pay_status);
    if (m.pay_method != null) s.pay_method = String(m.pay_method);
    if (m.note != null) s.note = String(m.note);
    if (Number(m.amount) > 0) s.amount = Number(m.amount);
    if (Number(m.pages) > 0) s.pages = Number(m.pages);
    s.pc_deleted = Number(m.pc_deleted) ? 1 : 0; s.srv_deleted = Number(m.srv_deleted) ? 1 : 0;
    if (sess.paidLocal && !s.pay_status && !s.note) s.pay_status = 'paid';          // Razorpay already confirmed it; the counter's own confirmation follows within seconds
    sess.waiters = sess.waiters.filter(function (w) { if (w.test(s)) { clearTimeout(w.t); w.ok(); return false; } return true; });
    if (TERMINAL[s.status] || (s.status === 'printed' && s.pc_deleted && s.srv_deleted)) setTimeout(function () { closeLink(sess); }, 4000);
  }
  function closeLink(sess) { try { sess.link && sess.link.conn && sess.link.conn.close(); } catch (e) {} try { sess.link && sess.link.peer && sess.link.peer.destroy(); } catch (e) {} sess.link = null; }
  function live(sess) { var c = sess.link && sess.link.conn; return !!(c && c.open); }

  function wire(sess) {
    var link = sess.link, conn = link.conn;
    conn.on('data', function (m) {
      if (!m || typeof m !== 'object' || m.orderId !== sess.id) return;
      if (m.t === 'status') onStatus(sess, m);
      else if (m.t === 'gone' && !TERMINAL[sess.state.status] && sess.state.status !== 'printed') onStatus(sess, { status: 'expired' });
    });
    conn.on('close', function () { if (sess.link === link) sess.link = null; });
    conn.on('error', function () { if (sess.link === link) sess.link = null; });
    try { conn.send({ t: 'get', orderId: sess.id }); sess.lastGet = Date.now(); } catch (e) {}
  }
  /* (re)open the connection when it dropped (phone slept, network change). Resolves true/false, never throws. */
  function ensureLink(sess, ms) {
    if (live(sess)) return Promise.resolve(true);
    if (sess.linking) return sess.linking;
    return sess.linking = (async function () {
      try { closeLink(sess); sess.link = await connect(ms || 6000); wire(sess); return true; }
      catch (e) { sess.link = null; return false; }
      finally { sess.linking = null; }
    })();
  }
  function waitFor(sess, test, ms, msg) {
    return new Promise(function (ok, no) {
      if (test(sess.state)) return ok();
      var w = { test: test, ok: ok, t: setTimeout(function () { sess.waiters = sess.waiters.filter(function (x) { return x !== w; }); no(new Error(msg)); }, ms) };
      sess.waiters.push(w);
    });
  }
  function send(sess, msg) { try { if (live(sess)) { sess.link.conn.send(msg); return true; } } catch (e) {} return false; }

  /* what GET /api/orders/:id answers for a P2P order (same shape as the Worker's orderStatus) */
  function status(id) {
    var sess = SESS[id]; if (!sess) return null;
    if (!live(sess)) ensureLink(sess);                                              // heal in the background
    else if (Date.now() - sess.lastGet > 5000) { sess.lastGet = Date.now(); send(sess, { t: 'get', orderId: id }); }
    return snap(sess);
  }
  /* "Pay at Counter": tell the counter, wait until it flips the order to cash_wait */
  async function payAtCounter(id) {
    var sess = SESS[id]; if (!sess) throw new Error('Order not found or expired');
    var s = sess.state;
    if (s.status === 'cash_wait' || s.pay_status === 'paid' || s.pay_status === 'cash_received') return snap(sess);
    if (!(await ensureLink(sess, 6000))) throw new Error('Could not reach the counter. Check your internet and try again.');
    var p = waitFor(sess, function (x) { return x.status === 'cash_wait' || x.pay_status === 'paid' || x.pay_status === 'cash_received'; }, 8000, 'The counter did not answer. Please try again.');
    send(sess, { t: 'pay', orderId: id, method: 'counter' });
    await p;
    return snap(sess);
  }
  function notifyPaying(id) { var sess = SESS[id]; if (!sess) return; ensureLink(sess).then(function () { send(sess, { t: 'paying', orderId: id }); }); }
  function notifyPaid(id, info) {
    var sess = SESS[id]; if (!sess) return;
    sess.paidLocal = true; sess.state.pay_status = 'paid'; sess.state.pay_method = 'upi';
    ensureLink(sess).then(function () { send(sess, { t: 'paid', orderId: id, paymentId: String((info && info.razorpay_payment_id) || '') }); });
  }

  /* ---------- fetch shim: P2P order ids are answered here, everything else goes to the network untouched ---------- */
  (function () {
    if (!window.fetch || window.fetch.__p2p) return;
    var real = window.fetch.bind(window);
    var shim = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || String(input || '');
        var path = url.replace(/^https?:\/\/[^\/]+/, '').split('?')[0].split('#')[0];
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        var m = /^\/api\/orders\/(P2P-[A-Z0-9]{4,12})(\/pay-at-counter)?$/.exec(path);
        if (m && !m[2] && method === 'GET') { var st = status(m[1]); return Promise.resolve(st ? jsonRes(st) : jsonRes({ error: 'Order not found' }, 404)); }
        if (m && m[2] && method === 'POST') {
          return payAtCounter(m[1]).then(function (st) { return jsonRes({ ok: true, status: st.status, pay_status: st.pay_status }); },
            function (e) { return jsonRes({ error: (e && e.message) || 'Could not reach the counter' }, 503); });
        }
        if (method === 'POST' && init && typeof init.body === 'string' && /^\/api\/(create-order|verify-payment)$/.test(path)) {
          var b = null; try { b = JSON.parse(init.body); } catch (e) {}
          var sess = b && SESS[String(b.orderId || '')];
          if (sess) {
            var isCreate = /create-order$/.test(path);
            if (isCreate) {                                                         // the Worker recomputes the price from these options
              var meta = {}; Object.keys(sess.meta).forEach(function (k) { meta[k] = sess.meta[k]; });
              var pg = (Array.isArray(meta.pages) ? meta.pages : []).slice(0, sess.fileCount); while (pg.length < sess.fileCount) pg.push(1);
              meta.pages = pg; b.meta = meta;
            }
            var init2 = {}; Object.keys(init).forEach(function (k) { init2[k] = init[k]; }); init2.body = JSON.stringify(b);
            return real(input, init2).then(function (res) {
              try {
                res.clone().json().then(function (j) {
                  if (isCreate && res.ok && j && j.order_id) notifyPaying(sess.id);
                  if (!isCreate && res.ok && j && j.success) notifyPaid(sess.id, b);
                }).catch(function () {});
              } catch (e) {}
              return res;
            });
          }
        }
      } catch (e) { /* never break a normal request */ }
      return real(input, init);
    };
    shim.__p2p = true; window.fetch = shim;
  })();

  /* ---------- public entry: P2P first, silent automatic fallback to the existing server upload ---------- */
  async function submit(opt) {
    var btn = opt.btn || null;
    pill(btn, 'try');
    try {
      var d = await direct(opt);
      pill(btn, 'p2p');
      return d;
    } catch (e) {
      try { console.warn('[P2P] direct transfer not possible -> server fallback:', e && e.message); } catch (x) {}
      pill(btn, 'server');
      var r = await opt.fallback();
      if (r && typeof r === 'object') r.via = 'server';
      return r;
    }
  }

  window.P2P = { COUNTER_ID: COUNTER_ID, CHUNK: CHUNK, ICE: ICE, CONNECT_MS: CONNECT_MS, loadPeer: loadPeer, warm: warm, estimate: estimate, submit: submit, direct: direct, pill: pill,
    isP2P: isP2PId, status: status, payAtCounter: payAtCounter, notifyPaid: notifyPaid, notifyPaying: notifyPaying };

  /* start downloading PeerJS once the page is idle (customer pages only; the counter loads it itself) */
  if (!/counter/i.test(location.pathname)) {
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 }); else setTimeout(warm, 1200);
  }
})();
