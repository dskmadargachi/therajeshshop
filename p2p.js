/* =====================================================================================================================
   p2p.js — direct browser -> counter file transfer over a WebRTC DataChannel (PeerJS). NO Cloudflare Worker involved.

   Customer pages call:
       P2P.submit({ files:[File], meta:{...same meta the /api/orders upload uses (incl. duplex + totalPages)...}, cfg, btn, fallback: () => post(fd) })
   -> resolves a { id, amount, status, p2p:true, via:'p2p', channel }  object when the counter ACKs the order, or whatever
      `fallback()` resolves (the existing /api/orders upload) when P2P cannot be used. The files are already in memory,
      so the customer never has to pick them again.

   v20 — SAME ORDER FLOW AS A NORMAL UPLOAD
     * No payment dialog before sending any more. The files go to the counter first; the customer then lands on the normal
       "Order placed (Step 3 of 3)" screen and chooses  Pay Now (Razorpay)  or  Pay at Counter  there (see wizard.js -> OrderUI).
     * The WebRTC link to the counter stays open after the ACK and becomes a small status channel (result.channel):
           channel.onStatus(fn)      fn({status, pay_status, pay_method, pc_deleted, srv_deleted, ...}) every time the counter changes the order,
                                     in exactly the shape /api/orders/:id returns, so the Upload -> Pay -> Print -> Delete from PC ->
                                     Delete from server tracker is driven by the same renderer as a normal order
           channel.pay({paymentMode}) tell the counter how the customer pays:  'counter'  or  'online' (the counter then re-checks
                                     the Razorpay payment with /api/orders/:id before it marks the order paid)
           channel.close()           hang up
       The link re-connects by itself if it drops (and re-sends 'watch').

   Wire protocol (PeerJS "binary" serialization, one DataConnection per order, counter peer id below):
       sender -> counter   { t:'meta',  orderId, transferId, idx, fileCount, fileName, mimeType, fileSize, totalChunks, customerName, printOptions,
                             duplex, totalPages, paymentMethod:'pay_at_counter', paymentStatus:'pending', amount, upiRef:'', paidAt:0 }
                           { t:'chunk', transferId, i, data:ArrayBuffer(<=32768) }
                           { t:'end',   transferId }
                           { t:'watch', orderId }                          (NEW: send me status updates for this order)
                           { t:'pay',   orderId, paymentMode:'counter'|'online' }   (NEW)
       counter -> sender   { t:'ack',   transferId }                      (one file fully received + verified)
                           { t:'order', orderId, amount, status }          (whole order is now in the counter queue  => ACK)
                           { t:'nack',  transferId, error }                (counter refused it -> sender falls back to the server)
                           { t:'status', orderId, status, pay_status, pay_method, pc_deleted, srv_deleted }   (NEW)
                           { t:'pay-ack', orderId, paymentMode, ok, error }                                   (NEW)
   Also used by the counter page: P2P.loadPeer(), P2P.estimate(), P2P.COUNTER_ID, P2P.ICE, P2P.CHUNK.
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

  /* exact page count of an order = sum of the (selected) pages of every file */
  function pagesOf(meta) {
    meta = meta || {};
    return (Array.isArray(meta.pages) && meta.pages.length ? meta.pages : [1]).reduce(function (s, n) { return s + Math.min(Math.max(parseInt(n) || 1, 1), 2000); }, 0);
  }

  /* ---------- price estimate (same formula as _worker.js createOrder; the counter recomputes it authoritatively) ---------- */
  function estimate(meta, cfg) {
    meta = meta || {}; cfg = cfg || {};
    var r = cfg.rate || {}, pp = cfg.passport || {};
    var bw = +r.bw || 5, col = +r.color || 10, a3 = +cfg.a3 || 2, ph = +cfg.photo4x6 || 20;
    var kind = meta.kind === 'passport' ? 'passport' : 'doc';
    var paper = ['A4', 'A3', '4x6'].indexOf(meta.paper) >= 0 ? meta.paper : 'A4';
    var color = (meta.color || paper === '4x6' || kind === 'passport') ? 1 : 0;
    var copies = Math.min(Math.max(parseInt(meta.copies) || 1, 1), kind === 'passport' ? 20 : 100);
    var pages = pagesOf(meta);
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

  /* ---------- status channel: the open link to the counter after the ACK ---------- */
  function makeChannel(orderId, first) {
    var link = first, listeners = [], waiters = [], closed = false, last = null, tries = 0, timer = 0, connecting = null;
    function emit(m) { last = m; listeners.slice().forEach(function (fn) { try { fn(m); } catch (e) {} }); }
    function attach(l) {
      link = l;
      l.conn.on('data', function (m) {
        if (!m || typeof m !== 'object' || m.orderId !== orderId) return;
        if (m.t === 'status') emit({ status: m.status, pay_status: m.pay_status || '', pay_method: m.pay_method || '', pc_deleted: Number(m.pc_deleted) || 0, srv_deleted: Number(m.srv_deleted) || 0, id: orderId, via: 'p2p' });
        else if (m.t === 'pay-ack') {
          for (var i = 0; i < waiters.length; i++) if (waiters[i].mode === m.paymentMode) {
            var w = waiters.splice(i, 1)[0]; clearTimeout(w.timer);
            if (m.ok) w.res(m); else w.rej(new Error(m.error || 'The counter could not confirm this'));
            break;
          }
        }
      });
      var lost = function () { if (!closed && link === l) lose(); };
      l.conn.on('close', lost); l.conn.on('error', lost);
      try { l.conn.send({ t: 'watch', orderId: orderId }); } catch (e) {}
    }
    function lose() {                                    // link dropped: re-open it quietly (a few tries, growing pause)
      clearTimeout(timer);
      if (closed || tries >= 6) return;
      timer = setTimeout(function () { ensure().catch(function () { lose(); }); }, Math.min(3000 * (tries + 1), 15000));
    }
    function ensure() {
      if (closed) return Promise.reject(new Error('closed'));
      if (link && link.conn && link.conn.open) return Promise.resolve(link);
      if (connecting) return connecting;
      tries++;
      try { link && link.peer && link.peer.destroy(); } catch (e) {}
      connecting = connect(CONNECT_MS * 2).then(function (l) { connecting = null; tries = 0; attach(l); return l; }, function (e) { connecting = null; throw e; });
      return connecting;
    }
    function wake() { if (!closed && !(link && link.conn && link.conn.open)) { tries = 0; ensure().catch(function () { lose(); }); } }
    var onVis = function () { if (!document.hidden) wake(); };
    document.addEventListener('visibilitychange', onVis); window.addEventListener('online', wake);
    attach(first);
    return {
      onStatus: function (fn) { listeners.push(fn); if (last) { try { fn(last); } catch (e) {} } },
      pay: function (o) {
        var mode = o && o.paymentMode === 'online' ? 'online' : 'counter';
        return ensure().then(function (l) {
          return new Promise(function (res, rej) {
            var w = { mode: mode, res: res, rej: rej, timer: setTimeout(function () { var k = waiters.indexOf(w); if (k >= 0) waiters.splice(k, 1); rej(new Error('The counter did not answer in time')); }, mode === 'online' ? 20000 : 10000) };
            waiters.push(w);
            try { l.conn.send({ t: 'pay', orderId: orderId, paymentMode: mode }); } catch (e) { clearTimeout(w.timer); waiters.splice(waiters.indexOf(w), 1); rej(e); }
          });
        });
      },
      close: function () {
        if (closed) return; closed = true; clearTimeout(timer); listeners = [];
        document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', wake);
        waiters.splice(0).forEach(function (w) { clearTimeout(w.timer); w.rej(new Error('closed')); });
        var l = link; setTimeout(function () { try { l.conn.close(); } catch (e) {} try { l.peer.destroy(); } catch (e) {} }, 300);
      }
    };
  }

  /* ---------- stream the order; resolves when the counter has ACKed it, throws on ANY problem ---------- */
  /* connect -> send files + order details -> counter ACK -> keep the link open as the status channel.
     Payment is NOT asked here any more: the order is sent as "Pay at Counter / not paid yet", and the customer picks
     Pay Now (Razorpay) or Pay at Counter on the Order-placed screen. */
  async function direct(opt) {
    var files = opt.files || [], meta = opt.meta || {};
    if (!files.length) throw new Error('No files');
    var total = 0; files.forEach(function (f) { total += f.size; });
    var orderId = newId(), est = estimate(meta, opt.cfg);
    var totalPages = Number(meta.totalPages) > 0 ? Math.round(Number(meta.totalPages)) : pagesOf(meta);
    var duplex = meta.duplex === true;
    var task = window.Prog ? Prog.start('Connecting to counter…') : null;
    var link = null, conn = null, dc = null, handedOver = false;
    var S = { closed: false, order: null, nack: null };
    try {
      link = await connect(CONNECT_MS); conn = link.conn; dc = conn.dataChannel;
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
      var printOptions = {}; Object.keys(meta).forEach(function (k) { printOptions[k] = meta[k]; });
      printOptions.estAmount = est; printOptions.duplex = duplex; printOptions.totalPages = totalPages;
      var payment = { paymentMethod: 'pay_at_counter', paymentStatus: 'pending', amount: est, upiRef: '', paidAt: 0 };
      Object.keys(payment).forEach(function (k) { printOptions[k] = payment[k]; });
      var sent = 0, lastPaint = 0;
      for (var i = 0; i < files.length; i++) {
        var f = files[i], buf = await f.arrayBuffer();
        var n = Math.max(1, Math.ceil(buf.byteLength / CHUNK)), tid = orderId + '-' + i;
        check();
        var metaMsg = { t: 'meta', orderId: orderId, transferId: tid, idx: i, fileCount: files.length, fileName: f.name, mimeType: f.type || 'application/octet-stream',
          fileSize: buf.byteLength, totalChunks: n, customerName: String(meta.name || ''), printOptions: printOptions, duplex: duplex, totalPages: totalPages };
        Object.keys(payment).forEach(function (k) { metaMsg[k] = payment[k]; });
        conn.send(metaMsg);
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
      var channel = makeChannel(orderId, link); handedOver = true;     // the link now belongs to the status channel
      return { id: orderId, amount: amt, status: S.order.status || 'cash_wait', p2p: true, via: 'p2p', channel: channel,
               paymentMethod: payment.paymentMethod, paymentStatus: S.order.paymentStatus === 'paid' ? 'paid' : 'pending',
               duplex: duplex, totalPages: totalPages };
    } catch (e) {
      if (task) task.fail();
      if (!handedOver) {
        try { link && link.conn && link.conn.close(); } catch (x) {}
        try { link && link.peer && link.peer.destroy(); } catch (x) {}
      }
      throw e;
    }
  }

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

  window.P2P = { COUNTER_ID: COUNTER_ID, CHUNK: CHUNK, ICE: ICE, CONNECT_MS: CONNECT_MS, loadPeer: loadPeer, warm: warm, estimate: estimate, pagesOf: pagesOf,
                 submit: submit, direct: direct, pill: pill };

  /* start downloading PeerJS once the page is idle (customer pages only; the counter loads it itself) */
  if (!/counter/i.test(location.pathname)) {
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 }); else setTimeout(warm, 1200);
  }
})();
