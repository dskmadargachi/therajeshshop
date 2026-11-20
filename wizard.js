/* therajesh.shop — wizard.js
   Tiny shared controller for the multi-step bottom-sheet wizard, generic modals,
   copies steppers and body scroll-lock. No dependencies. Page scripts register their flows:
     Wiz.register('doc', {steps:3, titles:[...], guard:(from,to)=>true})
   Optional flow settings: home (step a flow opens on, default 1; steps below it are optional
   "side" views that get a back button returning home) and hideSteps (hide the "Step n of N" label + progress bar;
   either true/false or a function(step) so e.g. only the final Order & payment step shows "Step 3 of 3").
     Wiz.open('doc') / Wiz.go(2) / Wiz.close() / Wiz.sync('doc', count) / Wiz.showDone('doc')
   Every existing element id stays untouched: the wizard only decides which pane is visible. */
(function () {
  'use strict';
  var html = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var cfg = {};
  var st = { flow: null, step: 1, open: false, done: {}, count: {} };

  /* ---------- one compact top bar: the language switch moves into the brand row ---------- */
  function compactHeader() {
    var sg = document.querySelector('.sui .sg'), tin = document.querySelector('.topbar-in');
    if (sg && tin && !tin.contains(sg)) tin.appendChild(sg);
    return !!(sg && tin);
  }
  function initHeader() {
    if (compactHeader()) return;
    var n = 0, t = setInterval(function () { if (compactHeader() || ++n > 20) clearInterval(t); }, 100);
  }

  /* ---------- body scroll lock: wizard, previews, password sheet, PDF modal, popups ---------- */
  var LOCK_SEL = '.preview-overlay:not(.hidden),.password-overlay:not(.hidden),#modal.on,#pv.on,.pop-back.show,.wzm.on,.wz.on';
  function lockSync() { html.classList.toggle('wz-lock', !!document.querySelector(LOCK_SEL)); }
  function watchLock() {
    lockSync();
    new MutationObserver(lockSync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- wizard ---------- */
  function root() { return $('wz'); }
  function overlayAbove() { return document.querySelector('.preview-overlay:not(.hidden),.password-overlay:not(.hidden),#pv.on'); }

  function render(step, dir) {
    var r = root(), f = cfg[st.flow]; if (!r || !f) return;
    st.step = step;
    var home = f.home || 1;
    r.classList.toggle('wz-nosteps', typeof f.hideSteps === 'function' ? !!f.hideSteps(step) : !!f.hideSteps);
    [].forEach.call(r.querySelectorAll('.wz-pane'), function (p) {
      var on = p.dataset.flow === st.flow && +p.dataset.step === step;
      p.classList.toggle('rev', dir < 0);
      p.classList.toggle('on', on);
    });
    [].forEach.call(r.querySelectorAll('.wz-act'), function (a) {
      a.classList.toggle('on', a.dataset.flow === st.flow && +a.dataset.step === step);
    });
    [].forEach.call(r.querySelectorAll('.wz-sum'), function (m) {
      m.classList.toggle('on', m.dataset.flow === st.flow && step >= (+m.dataset.from || 1));
    });
    $('wzN').textContent = step;
    $('wzT').textContent = f.steps;
    $('wzBar').style.width = (step / f.steps * 100) + '%';
    $('wzTitle').textContent = (f.titles && f.titles[step - 1]) || f.title || '';
    /* back button: below home it returns home, above home it steps back; on home itself (or step 1) it is hidden */
    var wb = $('wzBack'), wx = $('wzX');
    wb.hidden = !!st.done[st.flow] || !(step < home || (step > home && step > 1));
    wb.dataset.wz = step < home ? 'home' : 'prev';
    if (wx) wx.dataset.wz = step < home ? 'home' : 'close';
    $('wzBody').scrollTop = 0;
    r.classList.toggle('is-done', !!st.done[st.flow] && step === f.steps);
    if (f.onStep) try { f.onStep(step); } catch (e) {}
  }

  function open(flow, step) {
    var r = root(); if (!r || !cfg[flow]) return;
    st.flow = flow; st.open = true;
    r.classList.add('on'); r.setAttribute('aria-hidden', 'false');
    render(step || (st.done[flow] ? cfg[flow].steps : (cfg[flow].home || 1)), 1);
    updateResume();
    lockSync();
  }
  function close() {
    var r = root(); if (!r) return;
    st.open = false; r.classList.remove('on'); r.setAttribute('aria-hidden', 'true');
    updateResume(); lockSync();
  }
  function go(n, dir) {
    var f = cfg[st.flow]; if (!f) return;
    n = Math.max(1, Math.min(f.steps, n));
    if (n > st.step && f.guard && f.guard(st.step, n) === false) return;
    render(n, dir == null ? (n >= st.step ? 1 : -1) : dir);
  }

  /* "Continue your order" buttons on the main screen when the wizard was closed with work in progress */
  function updateResume() {
    [].forEach.call(document.querySelectorAll('[data-wz-resume]'), function (b) {
      var fl = b.dataset.wzResume, n = st.count[fl] || 0;
      var show = !(st.open && st.flow === fl) && (st.done[fl] || n > 0);
      b.classList.toggle('hidden', !show);
      b.hidden = !show;
    });
  }

  /* called by page scripts whenever the number of chosen files changes */
  function sync(flow, n) {
    var prev = st.count[flow] || 0; st.count[flow] = n;
    if (n > prev) { if (!(st.open && st.flow === flow)) open(flow); }
    else if (n === 0 && st.open && st.flow === flow && !st.done[flow]) close();
    updateResume();
  }

  /* after the order is created: the live tracker (#done) appears inside step 3 of the same wizard */
  function showDone(flow) {
    var r = root(), f = cfg[flow], d = $('done'); if (!r || !f) return;
    var slot = r.querySelector('.wz-pane[data-flow="' + flow + '"][data-step="' + f.steps + '"] .wz-done-slot');
    if (slot && d) slot.appendChild(d);
    st.done[flow] = true;
    if (d) d.classList.remove('hidden');
    st.flow = flow; st.open = true;
    r.classList.add('on');
    render(f.steps, 1);
    $('wzTitle').textContent = f.doneTitle || 'Order placed';
    updateResume();
  }

  /* a finished order must not leak into the next one: forget the done state and hide the old token */
  function resetDone(flow) {
    st.done[flow] = false;
    var d = $('done'), r = root();
    if (d) d.classList.add('hidden');
    if (r) r.classList.remove('is-done');
  }

  /* copy an element's text into another (so one #err can be shown in two steps) */
  function mirror(srcId, dstId) {
    var s = $(srcId), d = $(dstId); if (!s || !d) return;
    var cp = function () { d.textContent = s.textContent; };
    new MutationObserver(cp).observe(s, { childList: true, characterData: true, subtree: true }); cp();
  }

  /* ---------- generic bottom-sheet modals (.wzm) ---------- */
  function modal(id, on) {
    var m = $(id); if (!m) return;
    m.classList.toggle('on', on !== false);
    m.setAttribute('aria-hidden', on === false ? 'true' : 'false');
    lockSync();
  }

  document.addEventListener('click', function (e) {
    var t = e.target; if (!t.closest) return;
    var a;
    if ((a = t.closest('[data-wz]'))) {
      var k = a.dataset.wz;
      if (k === 'next') go(st.step + 1, 1);
      else if (k === 'prev') go(st.step - 1, -1);
      else if (k === 'close') close();
      else if (k === 'home') go((cfg[st.flow] && cfg[st.flow].home) || 1);
      else if (/^go:\d+$/.test(k)) go(+k.slice(3));
      return;
    }
    if ((a = t.closest('[data-wz-resume]'))) { open(a.dataset.wzResume); return; }
    if ((a = t.closest('[data-wz-modal]'))) { e.preventDefault(); modal(a.dataset.wzModal, true); return; }
    if ((a = t.closest('[data-wz-mclose]'))) { var m = a.closest('.wzm'); if (m) { modal(m.id, false); if (location.hash === '#privacy') history.replaceState(null, '', location.pathname + location.search); } return; }
    if (t.classList && t.classList.contains('wzm')) { modal(t.id, false); return; }
    if ((a = t.closest('.stepper button'))) {
      var inp = a.parentNode.querySelector('input'); if (!inp) return;
      var mn = +inp.min || 1, mx = +inp.max || 100, v = (parseInt(inp.value, 10) || mn) + (+a.dataset.step || 0);
      inp.value = Math.min(mx, Math.max(mn, v));
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (overlayAbove()) return;                      // the page's own preview/password handler closes that first
    var m = document.querySelector('.wzm.on'); if (m) { modal(m.id, false); return; }
    if (st.open) {
      var f = cfg[st.flow];
      if (f && f.home && st.step < f.home) go(f.home, 1);   // Escape inside a side view returns home first
      else close();
    }
  });

  /* #privacy links (from any page) open the compact privacy modal */
  function hashModal() { if (location.hash === '#privacy' && $('pvModal')) modal('pvModal', true); }
  window.addEventListener('hashchange', hashModal);

  window.Wiz = {
    register: function (flow, c) { cfg[flow] = c; },
    open: open, close: close, go: go, next: function () { go(st.step + 1, 1); }, prev: function () { go(st.step - 1, -1); },
    sync: sync, showDone: showDone, resetDone: resetDone, mirror: mirror, modal: modal,
    isOpen: function () { return st.open; }, step: function () { return st.step; }, flow: function () { return st.flow; }
  };

  function init() { initHeader(); watchLock(); hashModal(); updateResume(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();


/* =====================================================================================================================
   Prog — one progress bar + live percentage for every upload / read / processing job on the site.
     var t = Prog.start('Reading files…');   t.set(45);  t.set(45, 'Processing…');  t.done();   t.fail();
     t.part(i, n, frac)            multi-file batch: overall % = (i + frac) / n         (i = 0-based file index, frac = 0..1)
     Prog.readBuffer(file, cb)     FileReader.readAsArrayBuffer with onprogress -> cb(0..1)   (resolves an ArrayBuffer)
     Prog.upload(url, formData, {label})   XMLHttpRequest upload.onprogress: "Uploading… n%", then "Processing… n%" while the server
                                           works; resolves a fetch-like { ok, status, json(), text() }
   The percentage never goes backwards, and the card hides itself shortly after 100%.
   ===================================================================================================================== */
(function () {
  if (window.Prog) return;
  var css = '#pg{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:2600;width:min(92vw,400px);box-sizing:border-box;padding:12px 15px 13px;' +
    'border-radius:16px;background:#fff;color:#0f172a;box-shadow:0 18px 44px -10px rgba(15,23,42,.38),0 0 0 1px rgba(99,102,241,.2);opacity:0;transform:translate(-50%,22px);' +
    'pointer-events:none;transition:opacity .2s ease,transform .28s cubic-bezier(.16,1,.3,1);font-family:inherit}' +
    '#pg.on{opacity:1;transform:translate(-50%,0)}' +
    '#pg.ok .pg-b i{background:#16a34a}#pg.ok .pg-p{color:#16a34a}' +
    '#pg .pg-t{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:13.5px;font-weight:700;line-height:1.3}' +
    '#pg .pg-l{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#pg .pg-p{flex:none;font-variant-numeric:tabular-nums;color:#4f46e5;font-size:14px}' +
    '#pg .pg-b{height:8px;margin-top:9px;border-radius:99px;background:#e2e8f0;overflow:hidden}' +
    '#pg .pg-b i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899);transition:width .25s ease}' +
    '@media (prefers-reduced-motion:reduce){#pg,#pg .pg-b i{transition:none}}';
  var el = null, hideT = 0, cur = null, seq = 0;
  function build() {
    if (el) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'pg'; el.setAttribute('role', 'progressbar'); el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100');
    el.innerHTML = '<div class="pg-t"><span class="pg-l"></span><b class="pg-p">0%</b></div><div class="pg-b"><i></i></div>';
    document.body.appendChild(el);
  }
  function paint(task) {
    build(); clearTimeout(hideT); el.classList.remove('ok');
    var p = Math.round(task.pct);
    var l = el.querySelector('.pg-l'); if (l._k !== task.label) { l._k = task.label; l.textContent = task.label; }      // (compare the source text: site-ui may have translated the node)
    el.querySelector('.pg-p').textContent = p + '%';
    el.querySelector('.pg-b i').style.width = p + '%';
    el.setAttribute('aria-valuenow', p); el.setAttribute('aria-label', task.label + ' ' + p + '%');
    el.classList.add('on');
  }
  function hide(delay) { clearTimeout(hideT); hideT = setTimeout(function () { if (el) el.classList.remove('on'); }, delay || 0); }

  function start(label) {
    var id = ++seq, task = { id: id, label: label || 'Processing…', pct: 0, live: true };
    cur = task; paint(task);
    var api = {
      set: function (pct, lab) {
        if (!task.live) return api;
        if (lab) task.label = lab;
        pct = Math.max(0, Math.min(100, +pct || 0));
        if (pct > task.pct) task.pct = pct;                                  // never backwards
        if (cur === task) paint(task);
        return api;
      },
      part: function (i, n, frac, lab) { return api.set(((i + Math.max(0, Math.min(1, frac || 0))) / Math.max(1, n)) * 100, lab); },
      label: function (lab) { return api.set(task.pct, lab); },
      reset: function (lab) { if (!task.live) return api; task.pct = 0; if (lab) task.label = lab; if (cur === task) paint(task); return api; },     // new phase: starts again at 0 %
      done: function () { if (!task.live) return; task.pct = 100; if (cur === task) { paint(task); hide(450); } task.live = false; if (cur === task) cur = null; },
      ok: function (lab) {                                                 // confirmation state (e.g. counter ACK): full green bar + label, stays a little longer
        if (!task.live) return; task.pct = 100; if (lab) task.label = lab;
        if (cur === task) { paint(task); el.classList.add('ok'); hide(1800); }
        task.live = false; if (cur === task) cur = null;
      },
      fail: function () { task.live = false; if (cur === task) { cur = null; hide(0); } }
    };
    return api;
  }

  /* FileReader with real onprogress */
  function readBuffer(file, cb) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onprogress = function (e) { if (cb && e.lengthComputable && e.total) cb(e.loaded / e.total); };
      r.onload = function () { if (cb) cb(1); ok(r.result); };
      r.onerror = function () { no(r.error || new Error('read')); };
      r.onabort = function () { no(new Error('abort')); };
      try { r.readAsArrayBuffer(file); } catch (e) { no(e); }
    });
  }

  /* XHR upload with upload.onprogress, then a "Processing…" phase while the server answers */
  function upload(url, body, o) {
    o = o || {};
    return new Promise(function (ok, no) {
      var t = start(o.label || 'Uploading…'), x = new XMLHttpRequest(), trick = 0, proc = 0;
      function stopTrick() { clearInterval(trick); }
      x.open(o.method || 'POST', url, true);
      if (o.headers) Object.keys(o.headers).forEach(function (k) { x.setRequestHeader(k, o.headers[k]); });
      x.upload.onprogress = function (e) { if (e.lengthComputable && e.total) t.set(Math.min(e.loaded / e.total, 1) * 100); };      // exact bytes sent
      x.upload.onload = function () {                                          // all bytes sent: server is working
        t.set(100); t.reset(o.processLabel || 'Processing…'); proc = 0;                // phase 2: server is working, 0 -> 97 %
        trick = setInterval(function () { proc += (97 - proc) * 0.14; t.set(proc); }, 250);
      };
      x.onload = function () {
        stopTrick(); t.done();
        var txt = x.responseText || '';
        ok({ ok: x.status >= 200 && x.status < 300, status: x.status, text: function () { return Promise.resolve(txt); },
             json: function () { try { return Promise.resolve(JSON.parse(txt)); } catch (e) { return Promise.reject(e); } } });
      };
      x.onerror = x.ontimeout = function () { stopTrick(); t.fail(); no(new TypeError('Network error. Check your internet and try again.')); };
      x.onabort = function () { stopTrick(); t.fail(); no(new Error('Upload cancelled')); };
      try { x.send(body); } catch (e) { stopTrick(); t.fail(); no(e); }
    });
  }

  window.Prog = { start: start, readBuffer: readBuffer, upload: upload };
})();


/* =====================================================================================================================
   OrderUI — everything on the customer's order screens that is not the wizard frame itself.
     1. Print sides      OrderUI.state.duplex (false = Single-Sided, true = Duplex (Both Sides)); wires #sidesSeg in step 2
     2. Step-3 summary   OrderUI.recap(ul, info)  ->  Files · Pages · Paper · Mode · Sides · Copies (· Name)
     3. Order placed     OrderUI.show(order, ctx) ->  token, exact amount, summary, "Transferred via P2P" badge, step tracker
                         and the two payment buttons:
                           Pay Now         -> Razorpay checkout for the exact order amount
                           Pay at Counter  -> POST /api/pay-mode {orderId, paymentMode:"counter"}, closes any open Razorpay popup
     The SAME code path draws a normal upload and a P2P transfer. A normal order is followed by polling /api/orders/:id; a P2P order
     is followed through the open WebRTC link to the counter (order.channel, see p2p.js) and fed through the same renderer, so the
     tracker (Upload -> Pay -> Print -> Delete from PC -> Delete from server), the animation and the status texts are identical.
   ===================================================================================================================== */
(function () {
  'use strict';
  if (window.OrderUI) return;
  var $ = function (id) { return document.getElementById(id); };
  var state = { duplex: false };
  var SIDES = { single: 'Single-Sided', duplex: 'Duplex (Both Sides)' };
  var sidesLabel = function () { return state.duplex ? SIDES.duplex : SIDES.single; };
  var inr = function (n) { return '\u20B9' + (Math.round(Number(n) * 100) / 100).toFixed(2); };

  /* ---------- 1. Print sides selector (step 2) ---------- */
  function initSides() {
    var seg = $('sidesSeg'); if (!seg || seg._ready) return;
    seg._ready = true;
    var btns = [].slice.call(seg.querySelectorAll('button'));
    function paint() {
      btns.forEach(function (b) {
        var on = (b.dataset.v === 'duplex') === state.duplex;
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    function set(v) {
      state.duplex = !!v; paint();
      try { document.dispatchEvent(new CustomEvent('orderui:sides', { detail: { duplex: state.duplex } })); } catch (e) {}
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { if (!b.disabled) set(b.dataset.v === 'duplex'); }); });
    /* 4x6 photo paper is never printed on both sides: lock the selector to Single-Sided there */
    var paper = $('paperSeg');
    function syncPaper() {
      var on = paper && paper.querySelector('.on'), photo = !!(on && on.dataset.v === '4x6');
      var d = seg.querySelector('[data-v="duplex"]');
      if (d) { d.disabled = photo; d.title = photo ? 'Not available for 4\u00D76 photo paper' : ''; }
      if (photo && state.duplex) set(false);
    }
    if (paper) { try { new MutationObserver(syncPaper).observe(paper, { subtree: true, attributes: true, attributeFilter: ['class'] }); } catch (e) {} syncPaper(); }
    paint();
  }

  /* ---------- 2. Step-3 summary rows ---------- */
  function row(ul, label, value) {
    var li = document.createElement('li'), s = document.createElement('span'), b = document.createElement('b');
    s.textContent = label; b.textContent = value; li.appendChild(s); li.appendChild(b); ul.appendChild(li);
  }
  function recap(ul, info) {
    if (!ul) return; info = info || {}; ul.textContent = '';
    row(ul, 'Files', String(info.files));
    row(ul, 'Pages', String(info.pages));
    row(ul, 'Paper', String(info.paper));
    row(ul, 'Mode', String(info.mode));
    row(ul, 'Sides', sidesLabel());
    row(ul, 'Copies', String(info.copies));
    if (info.name) row(ul, 'Name', String(info.name));
  }

  /* ---------- 3. Order placed ---------- */
  var session = null;
  var STATUS_TEXT = {
    expired: 'Not paid within 60 minutes, so the upload was deleted.',
    pending: 'Waiting for counter approval\u2026',
    cash_wait: 'Pay at Counter: waiting for the counter to take your cash\u2026',
    approved: 'Approved. Sending to printer\u2026',
    printing: 'Printing now',
    printed: 'Printed. Please collect from the counter.',
    rejected: 'Rejected by counter',
    error: 'Printer problem. Please tell the counter.'
  };

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || 'Request failed'); e.status = r.status; e.body = j; throw e; }
        return j;
      });
    });
  }
  function loadScript(src, attrs, test) {
    return new Promise(function (ok, no) {
      if (test()) return ok();
      var s = document.createElement('script'); s.src = src; s.async = true;
      Object.keys(attrs || {}).forEach(function (k) { s.setAttribute(k, attrs[k]); });
      s.onload = function () { test() ? ok() : no(new Error('script')); }; s.onerror = function () { no(new Error('script')); };
      document.head.appendChild(s);
    });
  }

  function show(order, ctx) {
    ctx = ctx || {};
    if (session) session.stop();
    var cfg = ctx.cfg || {}, isP2P = !!order.p2p, amount = Number(order.amount) || 0;
    var S = session = {
      id: order.id, p2p: isP2P, ch: isP2P ? (order.channel || null) : null, meta: order.meta || {},
      paid: false, counter: false, busy: false, cbusy: false, verifying: false, registered: false, rzp: null, cancelled: false,
      stopped: false, timer: 0, last: null,
      online: !!(cfg.razorpay && cfg.razorpay.keyId) || (!isP2P && !!(cfg.youpi && cfg.youpi.key))
    };
    S.stop = function () { S.stopped = true; clearTimeout(S.timer); try { S.ch && S.ch.close(); } catch (e) {} };

    var msg = function (t) { var m = $('payMsg'); if (m) m.textContent = t; };
    var amountLine = function (a) { $('oamt').textContent = 'Exact amount to pay: ' + inr(a); };

    /* ----- screen frame: token, amount, summary, P2P badge ----- */
    if (window.Wiz) Wiz.showDone(ctx.flow || 'doc');
    $('done').classList.remove('hidden');
    $('oid').textContent = order.id;
    amountLine(amount);
    var badge = $('p2pViaBadge'); if (badge) badge.classList.toggle('hidden', !isP2P);
    var sum = $('rcDone'), src = $('rcDoc');
    if (sum) { sum.innerHTML = src && (ctx.flow || 'doc') === 'doc' ? src.innerHTML : ''; sum.classList.toggle('hidden', !sum.children.length); }
    var sl = $('rcDoneWrap'); if (sl) sl.classList.toggle('hidden', !(sum && sum.children.length));

    /* ----- buttons ----- */
    var bNow = $('payNow'), bCnt = $('payCounter'), acts = $('payActs'), paidBox = $('payPaid'), hint = $('payHint2');
    function paint() {
      if (paidBox) paidBox.classList.toggle('hidden', !S.paid);
      if (acts) acts.classList.toggle('hidden', S.paid);
      if (hint) hint.classList.toggle('hidden', S.paid);
      if (bNow) {
        bNow.disabled = S.busy || S.cbusy || S.verifying || !S.online;
        bNow.querySelector('.pb-t').textContent = (S.counter ? 'Pay online instead ' : 'Pay Now ') + inr(amount);
      }
      if (bCnt) {
        bCnt.disabled = S.cbusy || S.verifying || S.counter;     // stays usable while the Razorpay window is open: it closes that window
        bCnt.classList.toggle('sel', S.counter);
        bCnt.querySelector('.pb-t').textContent = S.counter ? '\u2713 Pay at Counter selected' : 'Pay at Counter';
      }
    }
    function markPaid(text) {
      S.paid = true; S.busy = false; S.cbusy = false; S.verifying = false;
      if (paidBox) paidBox.querySelector('.pp-t').textContent = text || 'Payment received. Thank you!';
      paint();
    }

    /* ----- status renderer (shared by server polling and the P2P link) ----- */
    function statusText(v) {
      var st = v.status;
      if (st === 'pending' || st === 'cash_wait') {
        if (v.pay_status === 'paid') return 'Payment received. Waiting in the print queue\u2026';
        if (S.counter) return STATUS_TEXT.cash_wait;
        return 'Waiting for your payment. Choose Pay Now or Pay at Counter.';
      }
      if (st === 'approved' && v.pay_status === 'paid') return 'Payment received. Sending to printer\u2026';
      return STATUS_TEXT[st] || st;
    }
    function apply(v) {
      if (!v || S.stopped) return;
      S.last = v;
      var st = v.status, cls = (st === 'cash_wait' ? 'pending' : st);
      var o = $('ost'); o.className = 'status s-' + cls; o.textContent = statusText(v);
      if ((v.pay_method === 'cash' || v.pay_method === 'pay_at_counter') && v.pay_status !== 'paid') { if (!S.counter && !S.paid) { S.counter = true; paint(); } }
      if (v.pay_status === 'paid' && !S.paid) markPaid();
      if (Number(v.amount) > 0 && Math.abs(Number(v.amount) - amount) > 0.01 && !isP2P) { amount = Number(v.amount); amountLine(amount); paint(); }
      try { ctx.track && ctx.track(v); } catch (e) {}
      try { window.ShopVoice && ShopVoice.trackOrder && ShopVoice.trackOrder(S.id, v); } catch (e) {}
    }
    function finished(v) {
      return v.status === 'rejected' || v.status === 'expired' || (v.status === 'printed' && Number(v.srv_deleted) > 0 && Number(v.pc_deleted) > 0);
    }

    /* ----- Pay at Counter ----- */
    function payCounter() {
      if (S.paid || S.counter || S.verifying) return;
      S.cancelled = true;                                          // an open Razorpay window is closed on purpose, not "cancelled by the customer"
      try { S.rzp && S.rzp.close && S.rzp.close(); } catch (e) {}
      S.rzp = null; S.busy = false; S.cbusy = true; paint(); msg('Confirming pay at counter\u2026');
      var step = (!S.p2p || S.registered) ? post('/api/pay-mode', { orderId: S.id, paymentMode: 'counter' }) : Promise.resolve({ ok: true });
      step.then(function () {
        return S.p2p && S.ch ? S.ch.pay({ paymentMode: 'counter' }).catch(function () { /* counter already holds it as a cash order */ }) : null;
      }).then(function () {
        S.counter = true; S.cbusy = false; paint();
        msg('Pay at Counter confirmed. Please pay ' + inr(amount) + ' in cash at the counter and show token ' + S.id + '.');
        apply({ status: (S.last && S.last.status === 'pending' && S.last.pay_status !== 'paid') ? 'cash_wait' : (S.last ? S.last.status : 'cash_wait'),
          pay_status: S.last ? S.last.pay_status : '', pay_method: 'cash', pc_deleted: S.last ? S.last.pc_deleted : 0, srv_deleted: S.last ? S.last.srv_deleted : 0 });
      }).catch(function (e) {
        S.cbusy = false;
        if (e && e.body && e.body.paid) { markPaid(); msg('This order was already paid online. Thank you!'); return; }
        paint(); msg((e && e.message ? e.message : 'Could not confirm') + '. Please try again, or just show this token at the counter.');
      });
    }

    /* ----- Pay Now (Razorpay) ----- */
    function razorpay() {
      var name = cfg.shop || 'Digital Seva Kendra';
      S.cancelled = false; S.busy = true; paint(); msg('Opening secure payment\u2026');
      var prep = S.p2p && !S.registered
        ? post('/api/p2p-order', { id: S.id, meta: S.meta }).then(function (r) { S.registered = true; if (Number(r.amount) > 0 && Math.abs(Number(r.amount) - amount) > 0.01) { amount = Number(r.amount); amountLine(amount); } })
        : Promise.resolve();
      return prep.then(function () {
        return loadScript('https://checkout.razorpay.com/v1/checkout.js', {}, function () { return !!window.Razorpay; });
      }).then(function () { return post('/api/create-order', { orderId: S.id }); }).then(function (w) {
        if (S.cancelled || S.paid) { S.busy = false; paint(); return; }
        var rz = new window.Razorpay({
          key: w.key_id, amount: w.amount, currency: w.currency, order_id: w.order_id, name: name, description: 'Print order ' + S.id, theme: { color: '#4f5bff' },
          handler: function (g) {
            S.verifying = true; S.rzp = null; paint(); msg('Verifying your payment\u2026');
            $('ost').textContent = 'Confirming your payment\u2026';
            post('/api/verify-payment', { orderId: S.id, razorpay_payment_id: g.razorpay_payment_id, razorpay_order_id: g.razorpay_order_id, razorpay_signature: g.razorpay_signature })
              .then(function () {
                S.counter = false;
                markPaid(); msg('Payment verified. Printing starts automatically.');
                try { window.ShopVoice && ShopVoice.paymentSuccess({ id: S.id }); } catch (e) {}
                if (S.p2p) {
                  var base = S.last || { status: 'pending', pc_deleted: 0, srv_deleted: 0 };
                  apply({ status: base.status === 'cash_wait' ? 'pending' : base.status, pay_status: 'paid', pay_method: 'pay_now', pc_deleted: base.pc_deleted, srv_deleted: base.srv_deleted });
                  if (S.ch) S.ch.pay({ paymentMode: 'online' }).catch(function () { msg('Payment received. The counter link dropped, so please show this token at the counter.'); });
                }
              })
              .catch(function (e) {
                S.verifying = false; S.busy = false; paint();
                msg((e.message || 'Could not verify the payment') + '. If money was deducted, show this token at the counter.');
              });
          },
          modal: { ondismiss: function () {
            S.rzp = null;
            if (S.cancelled || S.verifying || S.paid) return;
            S.busy = false; paint(); msg('Payment cancelled. Tap Pay Now to try again, or choose Pay at Counter.');
          } }
        });
        rz.on('payment.failed', function (g) { S.busy = false; S.rzp = null; paint(); msg('Payment failed: ' + ((g.error && g.error.description) || 'please try again') + '.'); });
        S.rzp = rz; rz.open();
      }).catch(function (e) {
        S.busy = false; paint();
        if (e && e.status === 409) { if (/already paid/i.test(e.message)) { markPaid(); return; } }
        msg((e && e.message && e.message !== 'script' ? e.message : 'Payment service is not reachable right now') + '. Try again, or choose Pay at Counter.');
      });
    }
    /* optional second gateway (Youpi) for normal uploads only, exactly as before */
    function youpi() {
      S.cancelled = false; S.busy = true; paint(); msg('Opening secure payment\u2026');
      return loadScript(cfg.youpi.base + '/youpi.js', { 'data-youpi-key': cfg.youpi.key, 'data-currency': 'INR' }, function () { return !!window.Youpi; }).then(function () {
        window.Youpi.pay({ order_id: S.id, amount: amount, currency: 'INR', name: cfg.shop || 'Digital Seva Kendra', description: 'Print order ' + S.id,
          handler: function () { $('ost').textContent = 'Confirming your payment\u2026'; msg('Complete the payment. Printing starts automatically.'); },
          onClose: function () { if (S.cancelled || S.paid) return; S.busy = false; paint(); msg('Payment window closed.'); } });
      }).catch(function () { S.busy = false; paint(); msg('Could not open the payment window. Try again, or choose Pay at Counter.'); });
    }
    function payNow() {
      if (S.paid || S.busy || !S.online) return;
      var useRzp = !!(cfg.razorpay && cfg.razorpay.keyId);
      (useRzp ? razorpay() : youpi());
    }

    if (bNow) bNow.onclick = payNow;
    if (bCnt) bCnt.onclick = payCounter;

    /* ----- first paint ----- */
    var first = { status: order.status || (isP2P ? 'cash_wait' : 'pending'), pay_status: order.paymentStatus === 'paid' ? 'paid' : '', pay_method: '', pc_deleted: 0, srv_deleted: 0 };
    paint();
    if (!(amount > 0)) { msg('Invalid payment amount'); if (bNow) bNow.disabled = true; if (bCnt) bCnt.disabled = true; }
    else if (!S.online) { msg('Online payment is not available right now. Please choose Pay at Counter.'); try { console.warn('Online payment off. Missing server variables:', (cfg.razorpayMissing || []).join(', ') || 'none reported'); } catch (e) {} }
    else msg('Choose how to pay: Pay Now (online) or Pay at Counter (cash).');
    if (first.pay_status === 'paid') markPaid();
    apply(first);

    /* ----- live updates ----- */
    if (isP2P) {
      if (S.ch) S.ch.onStatus(function (v) { apply(v); if (finished(v)) setTimeout(function () { try { S.ch.close(); } catch (e) {} }, 2000); });
    } else {
      var n = 0, doneAt = 0;
      (function poll() {
        if (S.stopped) return;
        if (document.hidden) {
          var again = function () { if (!document.hidden) { document.removeEventListener('visibilitychange', again); poll(); } };
          document.addEventListener('visibilitychange', again); return;
        }
        var wait = 3000;
        fetch('/api/orders/' + encodeURIComponent(S.id)).then(function (r) { return r.json(); }).then(function (v) {
          if (S.stopped || !v || v.error) return;
          apply(v);
          if (['approved', 'printing'].indexOf(v.status) >= 0 || (v.status === 'printed' && !v.srv_deleted)) wait = 1200;
          if (v.status === 'rejected' || v.status === 'expired') return 'stop';
          if (v.status === 'printed') { doneAt = doneAt || Date.now(); if ((v.srv_deleted && v.pc_deleted) || Date.now() - doneAt > 120000) return 'stop'; }
        }).catch(function () {}).then(function (stop) {
          if (stop === 'stop' || S.stopped || ++n > 1500) return;
          S.timer = setTimeout(poll, wait);
        });
      })();
    }
  }

  window.OrderUI = { state: state, sidesLabel: sidesLabel, recap: recap, show: show, initSides: initSides };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSides); else initSides();
})();
