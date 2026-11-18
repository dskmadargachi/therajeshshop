/* =====================================================================================================================
   p2p.js — direct browser -> counter file transfer over a WebRTC DataChannel (PeerJS). NO Cloudflare Worker involved.

   Customer pages call:
       P2P.submit({ files:[File], meta:{...same meta the /api/orders upload uses...}, cfg, btn, fallback: () => post(fd) })
   -> resolves a { id, amount, status, p2p:true, via:'p2p' }  object when the counter ACKs the order, or whatever
      `fallback()` resolves (the existing /api/orders upload) when P2P cannot be used. The files are already in memory,
      so the customer never has to pick them again.

   Wire protocol (PeerJS "binary" serialization, one DataConnection per order, counter peer id below):
       sender -> counter   { t:'meta',  orderId, transferId, idx, fileCount, fileName, mimeType, fileSize, totalChunks, customerName, printOptions,
                             // ---- CHANGED (v18): payment details travel with every meta message ----
                             paymentMethod:'pay_at_counter'|'pay_now', paymentStatus:'pending'|'paid', amount, upiRef, paidAt }
                           { t:'chunk', transferId, i, data:ArrayBuffer(<=32768) }
                           { t:'end',   transferId }
       counter -> sender   { t:'ack',   transferId }                      (one file fully received + verified)
                           { t:'order', orderId, amount, status }          (whole order is now in the counter queue  => ACK)
                           { t:'nack',  transferId, error }                (counter refused it -> sender falls back to the server)
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


  /* =====================================================================================================================
     CHANGED (v18) — CHECKOUT PAYMENT CHOICE (shown in P2P mode, after the counter link is up and before any byte is sent)
       P2P.askPayment({ amount, orderId, cfg }) -> Promise<{ paymentMethod, paymentStatus, amount, upiRef, paidAt }>
       * "Pay at Counter" -> { paymentMethod:'pay_at_counter', paymentStatus:'pending' }  -> files are sent straight away
       * "Pay Now"        -> UPI QR / "Open in any UPI app" step; the customer types the UPI reference (UTR) after paying
                             -> { paymentMethod:'pay_now', paymentStatus:'paid', upiRef }   -> files are sent afterwards
       Cancelling rejects with an Error whose .cancelled === true (submit() never falls back to the server for that).
       The UPI id comes from /api/config  ->  cfg.upi (+ cfg.upiName); it is set with the UPI_ID variable in Cloudflare.
     ===================================================================================================================== */
  var payCss = false;
  function payStyles() {
    if (payCss) return; payCss = true;
    var st = document.createElement('style');
    st.textContent =
      '.p2pp-ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.6);font-family:inherit}' +
      '@media(min-width:560px){.p2pp-ov{align-items:center}}' +
      '.p2pp{background:#fff;color:#0f172a;width:100%;max-width:440px;max-height:92vh;overflow:auto;border-radius:20px 20px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom,0px));box-sizing:border-box;box-shadow:0 -10px 40px rgba(0,0,0,.25)}' +
      '@media(min-width:560px){.p2pp{border-radius:20px}}' +
      '.p2pp h3{margin:0 0 4px;font-size:19px;font-weight:800}.p2pp .sub{margin:0 0 14px;color:#64748b;font-size:13.5px}' +
      '.p2pp .amt{font-size:26px;font-weight:900;margin:2px 0 14px;color:#047857}' +
      '.p2pp .opt{display:block;width:100%;text-align:left;margin:0 0 10px;padding:14px 14px;border:2px solid #e2e8f0;border-radius:14px;background:#fff;color:inherit;font:inherit;cursor:pointer}' +
      '.p2pp .opt:hover,.p2pp .opt:focus-visible{border-color:#059669;outline:none}.p2pp .opt b{display:block;font-size:16px}.p2pp .opt small{display:block;margin-top:2px;color:#64748b;font-size:12.5px;line-height:1.35}' +
      '.p2pp .opt.pn{background:#ecfdf5;border-color:#6ee7b7}' +
      '.p2pp .lnk{display:block;margin:8px auto 0;background:none;border:0;color:#475569;font:inherit;font-size:13.5px;text-decoration:underline;cursor:pointer}' +
      '.p2pp .qr{display:flex;justify-content:center;margin:6px 0 10px;min-height:180px}.p2pp .qr canvas,.p2pp .qr img{border-radius:8px}' +
      '.p2pp .go{display:block;width:100%;box-sizing:border-box;text-align:center;margin:0 0 10px;padding:12px;border-radius:12px;border:0;background:#059669;color:#fff;font:inherit;font-weight:800;font-size:15px;text-decoration:none;cursor:pointer}' +
      '.p2pp .go.alt{background:#e0f2fe;color:#075985}.p2pp input{display:block;width:100%;box-sizing:border-box;margin:0 0 10px;padding:12px;border:2px solid #cbd5e1;border-radius:12px;font:inherit;font-size:16px}' +
      '.p2pp .er{min-height:18px;margin:0 0 8px;color:#b91c1c;font-size:13px;font-weight:700}.p2pp .hint{color:#64748b;font-size:12.5px;line-height:1.4;margin:0 0 10px}' +
      '@media (prefers-color-scheme:dark){.p2pp{background:#0f172a;color:#e2e8f0}.p2pp .opt{background:#1e293b;border-color:#334155}.p2pp .opt.pn{background:#064e3b;border-color:#059669}.p2pp .opt small,.p2pp .sub,.p2pp .hint,.p2pp .lnk{color:#94a3b8}.p2pp input{background:#1e293b;color:#e2e8f0;border-color:#334155}.p2pp .amt{color:#6ee7b7}}';
    document.head.appendChild(st);
  }
  var inr = function (n) { return '\u20B9' + (Math.round(Number(n) * 100) / 100).toFixed(2); };
  function mk(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function lazyQR() {
    return new Promise(function (ok) {
      if (window.QRCode) return ok();
      var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.async = true;
      s.onload = ok; s.onerror = ok; document.head.appendChild(s);
    });
  }
  function upiLink(cfg, amount, orderId) {
    var e = encodeURIComponent;
    return 'upi://pay?pa=' + e(cfg.upi) + '&pn=' + e(cfg.upiName || cfg.shop || 'Print shop') + '&am=' + Number(amount).toFixed(2) +
           '&cu=INR&tn=' + e('Print ' + orderId) + '&tr=' + e(orderId);
  }
  var UTR_RX = /^[A-Za-z0-9]{8,24}$/;

  function askPayment(o) {
    o = o || {}; payStyles();
    var cfg = o.cfg || {}, amount = Number(o.amount) || 0, orderId = o.orderId || '';
    return new Promise(function (res, rej) {
      var ov = mk('div', 'p2pp-ov'), box = mk('div', 'p2pp'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      ov.appendChild(box); document.body.appendChild(ov);
      var prevFocus = document.activeElement;
      function close() { document.removeEventListener('keydown', onKey, true); try { ov.remove(); } catch (e) {} try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (e) {} }
      function cancel() { close(); var e = new Error('Payment cancelled'); e.cancelled = true; rej(e); }
      function onKey(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); cancel(); } }
      document.addEventListener('keydown', onKey, true);
      ov.addEventListener('click', function (ev) { if (ev.target === ov) cancel(); });

      function viewChoose() {
        box.textContent = '';
        box.appendChild(mk('h3', '', 'How would you like to pay?'));
        box.appendChild(mk('p', 'sub', 'Choose one to send your files to the counter.'));
        box.appendChild(mk('div', 'amt', inr(amount)));
        var bc = mk('button', 'opt'); bc.type = 'button';
        bc.appendChild(mk('b', '', '💵 Pay at Counter')); bc.appendChild(mk('small', '', 'Send now and pay when you collect your prints.'));
        var bn = mk('button', 'opt pn'); bn.type = 'button';
        bn.appendChild(mk('b', '', '📲 Pay Now')); bn.appendChild(mk('small', '', 'Pay online with any UPI app (QR shown next).'));
        var er = mk('div', 'er'); er.setAttribute('role', 'alert');
        var cx = mk('button', 'lnk', 'Cancel'); cx.type = 'button';
        bc.onclick = function () { close(); res({ paymentMethod: 'pay_at_counter', paymentStatus: 'pending', amount: amount, upiRef: '', paidAt: 0 }); };
        bn.onclick = function () {
          if (!cfg.upi) { er.textContent = 'Online payment is not set up yet. Please choose Pay at Counter.'; return; }   // option stays visible, never hidden
          viewPay();
        };
        cx.onclick = cancel;
        [bc, bn, er, cx].forEach(function (n) { box.appendChild(n); });
        try { bc.focus(); } catch (e) {}
      }

      function viewPay() {
        box.textContent = '';
        var link = upiLink(cfg, amount, orderId);
        box.appendChild(mk('h3', '', 'Pay ' + inr(amount)));
        box.appendChild(mk('p', 'sub', 'Scan the QR, or tap your UPI app, and pay the exact amount.'));
        var qr = mk('div', 'qr'); box.appendChild(qr);
        lazyQR().then(function () { try { if (window.QRCode) new QRCode(qr, { text: link, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M }); } catch (e) {} });
        var a = mk('a', 'go alt', 'Open in any UPI app'); a.href = link; box.appendChild(a);
        box.appendChild(mk('p', 'hint', 'After paying, type the UPI reference / UTR number from your payment app. The counter checks it before printing.'));
        var inp = mk('input'); inp.type = 'text'; inp.placeholder = 'UPI reference / UTR (e.g. 412345678901)'; inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false; inp.maxLength = 24;
        inp.setAttribute('inputmode', 'text'); inp.setAttribute('aria-label', 'UPI reference number');
        var er = mk('div', 'er'); er.setAttribute('role', 'alert');
        var ok = mk('button', 'go', "I've paid " + inr(amount)); ok.type = 'button';
        var bk = mk('button', 'lnk', '← Back'); bk.type = 'button';
        ok.onclick = function () {
          var v = String(inp.value || '').replace(/\s+/g, '');
          if (!UTR_RX.test(v)) { er.textContent = 'Enter the UPI reference number shown in your payment app (letters/digits, 8–24 characters).'; try { inp.focus(); } catch (e) {} return; }
          close(); res({ paymentMethod: 'pay_now', paymentStatus: 'paid', amount: amount, upiRef: v, paidAt: Date.now() });
        };
        bk.onclick = viewChoose;
        [inp, er, ok, bk].forEach(function (n) { box.appendChild(n); });
      }
      viewChoose();
    });
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
  /* CHANGED (v18): connect -> ask "Pay at Counter / Pay Now" -> (UPI step) -> send files + payment details.
     The payment dialog is shown only once the counter link is confirmed open, so a customer is never asked to pay
     for a transfer that then silently moves to the server. If the link drops while the dialog is open, it is re-opened. */
  async function direct(opt) {
    var files = opt.files || [], meta = opt.meta || {};
    if (!files.length) throw new Error('No files');
    var total = 0; files.forEach(function (f) { total += f.size; });
    var orderId = newId(), est = estimate(meta, opt.cfg);
    var task = window.Prog ? Prog.start('Connecting to counter…') : null;
    var link = null, conn = null, dc = null, pay = null;
    var S = { closed: false, order: null, nack: null };
    function bind(l) {                                   // (re)attach listeners to a fresh counter link
      link = l; conn = l.conn; dc = conn.dataChannel; S.closed = false;
      conn.on('data', function (m) {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'order' && m.orderId === orderId) S.order = m;
        else if (m.t === 'nack') S.nack = m;
      });
      conn.on('close', function () { S.closed = true; });
      conn.on('error', function () { S.closed = true; });
      link.peer.on('disconnected', function () { /* signalling dropped; the open DataChannel keeps working */ });
    }
    try {
      bind(await connect(CONNECT_MS));

      /* ---- CHANGED (v18): payment choice (skipped only if the caller already supplies opt.payment) ---- */
      if (opt.payment) pay = opt.payment;
      else {
        if (task) task.fail();                           // hide the progress strip while the customer decides
        task = null;
        pay = await askPayment({ amount: est, orderId: orderId, cfg: opt.cfg });   // rejects with .cancelled on Cancel
        task = window.Prog ? Prog.start('Sending directly to counter…') : null;
        if (S.closed || !conn.open) {                    // link died while the customer was paying -> open it again
          try { conn.close(); } catch (x) {} try { link.peer.destroy(); } catch (x) {}
          bind(await connect(CONNECT_MS * 2));
        }
      }

      var buffered = function () { return (dc ? dc.bufferedAmount : 0) + (conn.bufferSize || 0); };
      var check = function () { if (S.nack) throw new Error(S.nack.error || 'Counter refused the file'); if (S.closed) throw new Error('P2P connection lost'); };
      var drain = async function () {
        var t0 = Date.now();
        while (buffered() > HIGH_WATER) { check(); if (Date.now() - t0 > 30000) throw new Error('P2P transfer stalled'); await sleep(20); }
      };

      if (task) task.label('Sending directly to counter…');
      var printOptions = {}; Object.keys(meta).forEach(function (k) { printOptions[k] = meta[k]; }); printOptions.estAmount = est;
      /* CHANGED (v18): payment fields, mirrored inside printOptions so an older counter build still receives them */
      var payment = {
        paymentMethod: pay.paymentMethod === 'pay_now' ? 'pay_now' : 'pay_at_counter',
        paymentStatus: (pay.paymentMethod === 'pay_now' && pay.paymentStatus === 'paid') ? 'paid' : 'pending',
        amount: Number(pay.amount) > 0 ? Number(pay.amount) : est,
        upiRef: String(pay.upiRef || '').slice(0, 24),
        paidAt: Number(pay.paidAt) || 0
      };
      Object.keys(payment).forEach(function (k) { printOptions[k] = payment[k]; });
      var sent = 0, lastPaint = 0;
      for (var i = 0; i < files.length; i++) {
        var f = files[i], buf = await f.arrayBuffer();
        var n = Math.max(1, Math.ceil(buf.byteLength / CHUNK)), tid = orderId + '-' + i;
        check();
        var metaMsg = { t: 'meta', orderId: orderId, transferId: tid, idx: i, fileCount: files.length, fileName: f.name, mimeType: f.type || 'application/octet-stream',
          fileSize: buf.byteLength, totalChunks: n, customerName: String(meta.name || ''), printOptions: printOptions };
        Object.keys(payment).forEach(function (k) { metaMsg[k] = payment[k]; });          // CHANGED (v18)
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
      var lk = link, cn = conn;
      setTimeout(function () { try { cn.close(); } catch (e) {} try { lk.peer.destroy(); } catch (e) {} }, 600);
      var amt = Number(S.order.amount); if (!(amt > 0)) amt = est;
      /* CHANGED (v18): the result now carries the payment outcome so the "Order placed" screen can show it */
      return { id: orderId, amount: amt, status: 'pending', p2p: true, via: 'p2p',
               paymentMethod: payment.paymentMethod, paymentStatus: S.order.paymentStatus || payment.paymentStatus, upiRef: payment.upiRef };
    } catch (e) {
      if (task) task.fail();
      try { link && link.conn && link.conn.close(); } catch (x) {}
      try { link && link.peer && link.peer.destroy(); } catch (x) {}
      if (pay && pay.paymentStatus === 'paid') e.paidRef = pay.upiRef;      // CHANGED (v18): remember a payment that was already made
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
      /* CHANGED (v18): Cancel in the payment dialog is the customer's decision, NOT a P2P failure -> no server fallback */
      if (e && e.cancelled) { try { btn && btn._p2pPill && btn._p2pPill.remove(); btn && (btn._p2pPill = null); } catch (x) {} throw new Error('Payment cancelled. Nothing was sent.'); }
      try { console.warn('[P2P] direct transfer not possible -> server fallback:', e && e.message); } catch (x) {}
      pill(btn, 'server');
      var r = await opt.fallback();
      if (r && typeof r === 'object') {
        r.via = 'server';
        /* CHANGED (v18): customer already paid by UPI but P2P died afterwards -> tell the counter via the done screen */
        if (e && e.paidRef) { r.upiRef = e.paidRef; r.paidRef = e.paidRef; }
      }
      return r;
    }
  }

  window.P2P = { COUNTER_ID: COUNTER_ID, CHUNK: CHUNK, ICE: ICE, CONNECT_MS: CONNECT_MS, loadPeer: loadPeer, warm: warm, estimate: estimate, submit: submit, direct: direct, pill: pill,
                 askPayment: askPayment /* CHANGED (v18) */ };

  /* start downloading PeerJS once the page is idle (customer pages only; the counter loads it itself) */
  if (!/counter/i.test(location.pathname)) {
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 }); else setTimeout(warm, 1200);
  }
})();
