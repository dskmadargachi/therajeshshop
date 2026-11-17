/* =====================================================================================================================
   p2p.js — direct browser -> counter file transfer over a WebRTC DataChannel (PeerJS). NO Cloudflare Worker involved.

   Customer pages call:
       P2P.submit({ files:[File], meta:{...same meta the /api/orders upload uses...}, cfg, btn, fallback: () => post(fd) })
   -> resolves a { id, amount, status, p2p:true, via:'p2p' }  object when the counter ACKs the order, or whatever
      `fallback()` resolves (the existing /api/orders upload) when P2P cannot be used. The files are already in memory,
      so the customer never has to pick them again.

   Wire protocol (PeerJS "binary" serialization, one DataConnection per order, counter peer id below):
       sender -> counter   { t:'meta',  orderId, transferId, idx, fileCount, fileName, mimeType, fileSize, totalChunks, customerName, printOptions,
                             // ---- CHANGED (v19): payment details travel with every meta message ----
                             paymentMethod:'pay_at_counter'|'pay_now', paymentStatus:'pending'|'paid', amount, paidAt,
                             razorpayPaymentId, razorpayOrderId (pay_now only; upiRef kept for older pages) }
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
  /* CHANGED (v19): size rules */
  var MAX_FILE = 100 * 1024 * 1024;        // largest single file accepted over P2P (must match p2p-counter.js)
  var P2P_MIN = 1024 * 1024;               // any file larger than 1 MB is routed directly via P2P
  var SERVER_MAX = 25 * 1024 * 1024;       // the server upload (/api/orders) cannot take more than 25 MB (single file OR whole order)
  var BLOCK = CHUNK * 32;                  // files are read from disk 1 MB at a time instead of loading the whole file into memory
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
     CHANGED (v19) — UNIFIED CHECKOUT PAYMENT MODAL (P2P mode AND normal server-upload mode share it)
       P2P.askPayment({ amount, orderId, cfg [, p2p] }) -> Promise<{ paymentMethod, paymentStatus, amount, paidAt, razorpayPaymentId?, razorpayOrderId? }>
       * "Pay on Counter" -> { paymentMethod:'pay_at_counter', paymentStatus:'pending' }
       * "Pay Now"        -> Razorpay Checkout (cfg.razorpay + window.Razorpay, checkout.js is loaded on demand)
                              1. POST /api/create-order   { orderId, amount, p2p:true }  (P2P order)   |   { orderId }  (server order)
                              2. Razorpay Checkout opens, customer pays
                              3. POST /api/verify-payment { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature [, p2p:true] }
                              -> { paymentMethod:'pay_now', paymentStatus:'paid', razorpayPaymentId, amount, paidAt }
                             If Razorpay is closed / fails / cannot be verified the modal STAYS OPEN: retry Pay Now or pick Pay on Counter.
       Cancelling the modal (Cancel / Esc / tap outside) rejects with an Error whose .cancelled === true (submit() never falls back to the server for that).
       p2p flag: defaults to true when orderId starts with "P2P-", otherwise false (server order).
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
  function loadRzp() {
    return new Promise(function (ok, no) {
      if (window.Razorpay) return ok();
      var s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.async = true;
      s.onload = function () { window.Razorpay ? ok() : no(new Error('Razorpay could not be loaded')); };
      s.onerror = function () { try { s.remove(); } catch (e) {} no(new Error('Payment service is not reachable right now')); };
      document.head.appendChild(s);
    });
  }
  function postJSON(url, body) {
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Request failed'); return j; });
    });
  }

  function askPayment(o) {
    o = o || {}; payStyles();
    var cfg = o.cfg || {}, amount = Number(o.amount) || 0, orderId = o.orderId || '';
    var isP2P = o.p2p != null ? !!o.p2p : /^P2P-/.test(orderId);
    return new Promise(function (res, rej) {
      var ov = mk('div', 'p2pp-ov'), box = mk('div', 'p2pp'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      ov.appendChild(box); document.body.appendChild(ov);
      var prevFocus = document.activeElement, busy = false, verifying = false;
      function close() { document.removeEventListener('keydown', onKey, true); try { ov.remove(); } catch (e) {} try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (e) {} }
      function cancel() { if (busy) return; close(); var e = new Error('Payment cancelled'); e.cancelled = true; rej(e); }   // not while Razorpay is open
      function onKey(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); cancel(); } }
      document.addEventListener('keydown', onKey, true);
      ov.addEventListener('click', function (ev) { if (ev.target === ov) cancel(); });

      box.appendChild(mk('h3', '', 'How would you like to pay?'));
      box.appendChild(mk('p', 'sub', 'Choose one to send your files to the counter.'));
      box.appendChild(mk('div', 'amt', inr(amount)));
      var bc = mk('button', 'opt'); bc.type = 'button';
      bc.appendChild(mk('b', '', '💵 Pay on Counter')); bc.appendChild(mk('small', '', 'Send now and pay when you collect your prints.'));
      var bn = mk('button', 'opt pn'); bn.type = 'button';
      var bnT = mk('b', '', '📲 Pay Now'), bnS = mk('small', '', 'Pay online with Razorpay (UPI, cards, netbanking).');
      bn.appendChild(bnT); bn.appendChild(bnS);
      var er = mk('div', 'er'); er.setAttribute('role', 'alert');
      var cx = mk('button', 'lnk', 'Cancel'); cx.type = 'button';
      [bc, bn, er, cx].forEach(function (n) { box.appendChild(n); });

      function lock(on, label) { busy = on; bc.disabled = bn.disabled = on; cx.disabled = on; bnT.textContent = label || '📲 Pay Now'; }
      function again(msg) { verifying = false; lock(false); er.textContent = msg || ''; try { bn.focus(); } catch (e) {} }   // modal stays open

      bc.onclick = function () { if (busy) return; close(); res({ paymentMethod: 'pay_at_counter', paymentStatus: 'pending', amount: amount, paidAt: 0 }); };
      cx.onclick = cancel;

      async function verify(r) {
        verifying = true; lock(true, 'Verifying payment…'); er.textContent = '';
        try {
          var body = { orderId: orderId, razorpay_payment_id: r.razorpay_payment_id, razorpay_order_id: r.razorpay_order_id, razorpay_signature: r.razorpay_signature };
          if (isP2P) body.p2p = true;
          var v = await postJSON('/api/verify-payment', body);
          if (v && v.success === false) throw new Error(v.error || 'Payment could not be verified');
          close();
          res({ paymentMethod: 'pay_now', paymentStatus: 'paid', razorpayPaymentId: r.razorpay_payment_id, razorpayOrderId: r.razorpay_order_id, amount: amount, paidAt: Date.now() });
        } catch (e) {
          again((e.message || 'Could not verify the payment') + '. If money was deducted, note payment ID ' + (r.razorpay_payment_id || '') + ' and tell the counter, or choose Pay on Counter.');
        }
      }

      bn.onclick = async function () {
        if (busy) return;
        if (!cfg.razorpay) { er.textContent = 'Online payment is not set up yet. Please choose Pay on Counter.'; return; }   // option stays visible, never hidden
        er.textContent = ''; lock(true, 'Opening secure payment…');
        try {
          await loadRzp();
          var h = await postJSON('/api/create-order', isP2P ? { orderId: orderId, amount: amount, p2p: true } : { orderId: orderId });
          var rz = new window.Razorpay({
            key: h.key_id, amount: h.amount, currency: h.currency || 'INR', order_id: h.order_id,
            name: cfg.shop || 'Print shop', description: 'Print order ' + orderId, theme: { color: '#059669' },
            handler: function (r) { verify(r); },
            modal: { ondismiss: function () { if (!verifying) again('Payment cancelled. You can try again or choose Pay on Counter.'); } }
          });
          rz.on('payment.failed', function (x) { er.textContent = 'Payment failed: ' + ((x && x.error && x.error.description) || 'please try again') + '.'; });   // Razorpay's window stays open for a retry
          rz.open();
        } catch (e) { again((e && e.message) || 'Could not start the payment. Try again or choose Pay on Counter.'); }
      };
      try { bc.focus(); } catch (e) {}
    });
  }

  /* =====================================================================================================================
     CHANGED (v19) — "DIRECT P2P TRANSFER IN PROGRESS" POPUP (same .p2pp-ov / .p2pp look as the payment modal)
       Shown while files stream to the counter: live progress bar, current file name, transferred MB / total MB.
       Not dismissable; direct() closes it when the counter's `order` ACK arrives (or when the transfer fails).
     ===================================================================================================================== */
  var xferCss = false;
  function xferStyles() {
    if (xferCss) return; xferCss = true;
    var st = document.createElement('style');
    st.textContent =
      '.p2pp .pbar{height:10px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin:12px 0 8px}' +
      '.p2pp .pbar>i{display:block;height:100%;width:0;border-radius:999px;background:#059669;transition:width .12s linear}' +
      '.p2pp .fn{font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.p2pp .mb{display:flex;justify-content:space-between;gap:8px;font-size:13px;color:#475569;font-variant-numeric:tabular-nums}' +
      '@media (prefers-color-scheme:dark){.p2pp .pbar{background:#334155}.p2pp .mb{color:#94a3b8}}';
    document.head.appendChild(st);
  }
  var mbStr = function (n) { return (n / 1048576).toFixed(2) + ' MB'; };
  function transferPopup() {
    payStyles(); xferStyles();
    var ov = mk('div', 'p2pp-ov'), box = mk('div', 'p2pp');
    box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-live', 'polite'); box.setAttribute('aria-label', 'Direct P2P transfer in progress');
    var h = mk('h3', '', 'Direct P2P Transfer in progress — sending files directly to counter...'); h.style.fontSize = '17px';
    var fn = mk('div', 'fn', 'Preparing…'), bar = mk('div', 'pbar'), fill = mk('i'); bar.appendChild(fill);
    bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100');
    var mb = mk('div', 'mb'), mbL = mk('span', '', '0.00 MB / 0.00 MB'), mbR = mk('span', '', '0%'); mb.appendChild(mbL); mb.appendChild(mbR);
    var hint = mk('p', 'hint', 'Keep this page open until the counter confirms.'); hint.style.marginTop = '10px';
    [h, fn, bar, mb, hint].forEach(function (n) { box.appendChild(n); });
    ov.appendChild(box); document.body.appendChild(ov);
    return {
      set: function (sent, total, name, idx, count) {
        sent = Math.max(0, Math.min(sent, total)); var pc = total ? Math.round(sent / total * 100) : 0;
        fill.style.width = pc + '%'; bar.setAttribute('aria-valuenow', String(pc));
        mbL.textContent = mbStr(sent) + ' / ' + mbStr(total); mbR.textContent = pc + '%';
        if (name != null) fn.textContent = (count > 1 ? 'File ' + (idx + 1) + ' of ' + count + ' · ' : '') + name;
      },
      note: function (t) { hint.textContent = t; },
      close: function () { try { ov.remove(); } catch (e) {} }
    };
  }

  /* ---------- CHANGED (v19): routing helpers ---------- */
  var sumSize = function (files) { var t = 0; (files || []).forEach(function (f) { t += f.size || 0; }); return t; };
  function p2pEnabled(cfg) { return !(cfg && (cfg.p2p === false || cfg.p2pEnabled === false)); }
  /* true when P2P is enabled and ANY file is larger than 1 MB -> such orders always go directly over P2P */
  function shouldUseP2P(files, cfg) {
    if (!p2pEnabled(cfg)) return false;
    return (files || []).some(function (f) { return f && f.size > P2P_MIN; });
  }
  /* true when the server upload could NOT carry this order (single file or whole order above 25 MB) */
  function tooBigForServer(files) {
    return sumSize(files) > SERVER_MAX || (files || []).some(function (f) { return f && f.size > SERVER_MAX; });
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
  /* CHANGED (v19): connect -> ask "Pay on Counter / Pay Now" (Razorpay) -> send files + payment details while a
     "Direct P2P Transfer in progress" popup shows live progress -> popup closes on the counter's `order` ACK.
     The payment dialog is shown only once the counter link is confirmed open, so a customer is never asked to pay
     for a transfer that then silently moves to the server. If the link drops while the dialog is open, it is re-opened. */
  async function direct(opt) {
    var files = opt.files || [], meta = opt.meta || {};
    if (!files.length) throw new Error('No files');
    var total = sumSize(files);
    for (var q = 0; q < files.length; q++) if (files[q].size > MAX_FILE) throw new Error(files[q].name + ' is larger than 100 MB');
    var orderId = newId(), est = estimate(meta, opt.cfg);
    var task = window.Prog ? Prog.start('Connecting to counter…') : null;
    var link = null, conn = null, dc = null, pay = null, pop = null;
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

      /* payment choice (skipped only if the caller already supplies opt.payment) */
      if (opt.payment) pay = opt.payment;
      else {
        if (task) task.fail();                           // hide the progress strip while the customer decides
        task = null;
        pay = await askPayment({ amount: est, orderId: orderId, cfg: opt.cfg, p2p: true });   // rejects with .cancelled on Cancel
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
      pop = transferPopup();                             // CHANGED (v19): visible "Direct P2P Transfer in progress" popup
      pop.set(0, total, files[0].name, 0, files.length);
      var printOptions = {}; Object.keys(meta).forEach(function (k) { printOptions[k] = meta[k]; }); printOptions.estAmount = est;
      var isPaid = pay.paymentMethod === 'pay_now' && pay.paymentStatus === 'paid';
      /* payment fields, mirrored inside printOptions so an older counter build still receives them */
      var payment = {
        paymentMethod: isPaid ? 'pay_now' : 'pay_at_counter',
        paymentStatus: isPaid ? 'paid' : 'pending',
        amount: Number(pay.amount) > 0 ? Number(pay.amount) : est,
        upiRef: String(pay.upiRef || '').slice(0, 24),                                          // legacy (UPI/UTR) field, kept for older pages
        razorpayPaymentId: isPaid ? String(pay.razorpayPaymentId || '').slice(0, 40) : '',     // CHANGED (v19)
        razorpayOrderId: isPaid ? String(pay.razorpayOrderId || '').slice(0, 40) : '',
        paidAt: Number(pay.paidAt) || 0
      };
      Object.keys(payment).forEach(function (k) { printOptions[k] = payment[k]; });
      var sent = 0, lastPaint = 0;
      for (var i = 0; i < files.length; i++) {
        var f = files[i], size = f.size;
        var n = Math.max(1, Math.ceil(size / CHUNK)), tid = orderId + '-' + i, ci = 0;
        check();
        var metaMsg = { t: 'meta', orderId: orderId, transferId: tid, idx: i, fileCount: files.length, fileName: f.name, mimeType: f.type || 'application/octet-stream',
          fileSize: size, totalChunks: n, customerName: String(meta.name || ''), printOptions: printOptions };
        Object.keys(payment).forEach(function (k) { metaMsg[k] = payment[k]; });
        conn.send(metaMsg);
        for (var off = 0; off < size; off += BLOCK) {      // read 1 MB at a time: a 100 MB file never sits fully in memory
          var blk = await f.slice(off, Math.min(size, off + BLOCK)).arrayBuffer();
          for (var po = 0; po < blk.byteLength; po += CHUNK) {
            var part = blk.slice(po, Math.min(blk.byteLength, po + CHUNK));
            conn.send({ t: 'chunk', transferId: tid, i: ci++, data: part });
            sent += part.byteLength;
            await drain();
            var now = Date.now();
            if (now - lastPaint > 60) {
              lastPaint = now; var done = Math.max(0, sent - buffered());
              pop.set(done, total, f.name, i, files.length);
              if (task) task.set(Math.min(99, done / total * 100));
            }
          }
        }
        conn.send({ t: 'end', transferId: tid });
      }
      pop.set(total, total, files[files.length - 1].name, files.length - 1, files.length); pop.note('All data sent. Waiting for the counter to confirm…');
      if (task) task.set(99, 'Waiting for counter…');
      var t1 = Date.now();
      while (!S.order) {
        check();
        if (Date.now() - t1 > ACK_MS) throw new Error('Counter did not confirm in time');
        await sleep(40);
      }
      pop.close(); pop = null;                           // CHANGED (v19): counter sent the `order` ACK -> popup closes automatically
      if (task) (task.ok ? task.ok('Delivered to counter ✓') : task.done());
      var lk = link, cn = conn;
      setTimeout(function () { try { cn.close(); } catch (e) {} try { lk.peer.destroy(); } catch (e) {} }, 600);
      var amt = Number(S.order.amount); if (!(amt > 0)) amt = est;
      return { id: orderId, amount: amt, status: 'pending', p2p: true, via: 'p2p',
               paymentMethod: payment.paymentMethod, paymentStatus: S.order.paymentStatus || payment.paymentStatus,
               upiRef: payment.upiRef, razorpayPaymentId: payment.razorpayPaymentId };
    } catch (e) {
      if (pop) pop.close();
      if (task) task.fail();
      try { link && link.conn && link.conn.close(); } catch (x) {}
      try { link && link.peer && link.peer.destroy(); } catch (x) {}
      if (pay && pay.paymentStatus === 'paid') e.paidRef = pay.razorpayPaymentId || pay.upiRef;      // remember a payment that was already made
      throw e;
    }
  }

  /* ---------- public entry ----------
     CHANGED (v19):
       * P2P enabled -> always tried first; any file > 1 MB MUST travel this way (see shouldUseP2P).
       * P2P failed / offline / disabled -> silent fallback to the server upload ONLY when the order fits the server limit
         (every file AND the whole order <= 25 MB). Otherwise a clear error is thrown and nothing is uploaded. */
  async function submit(opt) {
    var btn = opt.btn || null, files = opt.files || [];
    var clearPill = function () { try { btn && btn._p2pPill && btn._p2pPill.remove(); btn && (btn._p2pPill = null); } catch (x) {} };
    var big = tooBigForServer(files), mbTotal = (sumSize(files) / 1048576).toFixed(1);
    for (var q = 0; q < files.length; q++) if (files[q].size > MAX_FILE) throw new Error(files[q].name + ' is larger than 100 MB. Please use a smaller file.');
    if (!p2pEnabled(opt.cfg)) {
      if (big) throw new Error('This order is ' + mbTotal + ' MB. Direct P2P transfer is turned off and the server upload accepts at most 25 MB. Please reduce the file size.');
      pill(btn, 'server');
      var r0 = await opt.fallback(); if (r0 && typeof r0 === 'object') r0.via = 'server'; return r0;
    }
    pill(btn, 'try');
    try {
      if (shouldUseP2P(files, opt.cfg)) { try { console.info('[P2P] file(s) larger than 1 MB -> routing directly via P2P'); } catch (x) {} }
      var d = await direct(opt);
      pill(btn, 'p2p');
      return d;
    } catch (e) {
      /* Cancel in the payment dialog is the customer's decision, NOT a P2P failure -> no server fallback */
      if (e && e.cancelled) { clearPill(); throw new Error('Payment cancelled. Nothing was sent.'); }
      try { console.warn('[P2P] direct transfer not possible:', e && e.message); } catch (x) {}
      if (big) {                                         // CHANGED (v19): no server fallback for orders the server cannot take
        clearPill();
        var why = (e && e.message) ? ' (' + e.message + ')' : '';
        var err = new Error('Direct P2P transfer to the counter failed' + why + ', and this order (' + mbTotal + ' MB) is too large for server upload (limit 25 MB). ' +
          'Please check that the counter is online and try again.' + (e && e.paidRef ? ' Your payment (ID ' + e.paidRef + ') was received — show it at the counter, do not pay again.' : ''));
        err.paidRef = e && e.paidRef;
        throw err;
      }
      pill(btn, 'server');
      var r = await opt.fallback();
      if (r && typeof r === 'object') {
        r.via = 'server';
        /* customer already paid online but P2P died afterwards -> tell the counter via the done screen */
        if (e && e.paidRef) { r.upiRef = e.paidRef; r.paidRef = e.paidRef; }
      }
      return r;
    }
  }

  window.P2P = { COUNTER_ID: COUNTER_ID, CHUNK: CHUNK, ICE: ICE, CONNECT_MS: CONNECT_MS, MAX_FILE: MAX_FILE, SERVER_MAX: SERVER_MAX,
                 loadPeer: loadPeer, warm: warm, estimate: estimate, submit: submit, direct: direct, pill: pill,
                 askPayment: askPayment, shouldUseP2P: shouldUseP2P, tooBigForServer: tooBigForServer };

  /* start downloading PeerJS once the page is idle (customer pages only; the counter loads it itself) */
  if (!/counter/i.test(location.pathname)) {
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 }); else setTimeout(warm, 1200);
  }
})();
