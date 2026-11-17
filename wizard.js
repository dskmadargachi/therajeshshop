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
   OrderUI — shared by every order page (index.html, cards.html, ...). Loaded with wizard.js, so no page needs extra markup.
     1. Step 3 summary: adds a "Pages" row (with the real page count) next to Files / Paper / Mode / Copies and keeps the bottom bar
        ("4 pages × 1 copy") in step with it.
     2. "Order placed" screen: after "Send to counter" the token + exact amount are shown and the customer picks
          [Pay Now]          -> Razorpay checkout for exactly that amount (opened ONLY by this button)
          [Pay at Counter]   -> tells the shop "I will pay cash"; the counter dashboard shows "Cash Pending" for that token
        Nothing opens Razorpay by itself any more (see the gate below).
     3. P2P orders (ids "P2P-XXXXXX") get a clear "Transferred via P2P" badge on this screen. Their status/payment travels through
        p2p.js, so the same tracker (Upload -> Pay -> Print -> Delete from PC -> Delete from server) animates for them too.
   Works with server orders and P2P orders alike because both are reached through  fetch('/api/orders/<id>') ,
   fetch('/api/orders/<id>/pay-at-counter') ,  fetch('/api/create-order')  and  fetch('/api/verify-payment') .
   Public API:  OrderUI.setPages(n)   OrderUI.refresh()
   ===================================================================================================================== */
(function () {
  'use strict';
  if (window.OrderUI) return;
  var $ = function (id) { return document.getElementById(id); };
  var RS = '\u20B9';

  /* ---------------------------------------------------------------- Razorpay gate
     The page scripts used to open Razorpay by themselves right after "Send to counter". Any checkout that was not started by the
     customer pressing "Pay Now" is swallowed here, so the order screen always appears first and the customer chooses. */
  var allowUntil = 0;
  function wrapRzp(C) {
    if (typeof C !== 'function' || C.__ou) return C;
    function G(opts) {
      var inst = new C(opts), open = inst && inst.open;
      if (typeof open === 'function') inst.open = function () { if (Date.now() > allowUntil) return inst; return open.apply(inst, arguments); };
      return inst;
    }
    G.prototype = C.prototype;
    try { Object.keys(C).forEach(function (k) { G[k] = C[k]; }); } catch (e) {}
    G.__ou = true;
    return G;
  }
  try {
    var _rz = window.Razorpay ? wrapRzp(window.Razorpay) : undefined;
    Object.defineProperty(window, 'Razorpay', { configurable: true, enumerable: true, get: function () { return _rz; }, set: function (v) { _rz = wrapRzp(v); } });
  } catch (e) { /* if the browser refuses, the page's own flow keeps working as before */ }
  function loadRzp() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.async = true;
      s.onload = function () { window.Razorpay ? ok() : no(new Error('Payment window could not start.')); };
      s.onerror = function () { no(new Error('Could not load the payment window. Check your internet and try again.')); };
      document.head.appendChild(s);
    });
  }

  /* ---------------------------------------------------------------- styles */
  var css = '.pf{display:grid;gap:10px;margin:4px 0;text-align:left}' +
    '.pf-h{text-align:center;font-weight:800;font-size:15px;color:#0f172a}' +
    '.pf-btn{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px;border-radius:16px;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;transition:transform .12s ease,box-shadow .2s ease,opacity .2s ease}' +
    '.pf-btn:active{transform:scale(.98)}.pf-btn:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}' +
    '.pf-btn[disabled]{opacity:.55;cursor:default;pointer-events:none}.pf-btn[hidden],.pf-msg[hidden]{display:none!important}' +
    '.pf-btn i{font-style:normal;font-size:24px;line-height:1;flex:none}' +
    '.pf-btn span{display:flex;flex-direction:column;gap:2px;min-width:0;font-size:16px;font-weight:800;line-height:1.2}' +
    '.pf-btn small{font-size:12px;font-weight:600;opacity:.85;line-height:1.3}' +
    '.pf-now{background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;box-shadow:0 10px 24px -10px rgba(37,99,235,.7)}' +
    '.pf-cash{background:#fff;color:#166534;border:2px solid #16a34a;padding:11px 14px}' +
    '.pf-msg{padding:10px 12px;border-radius:12px;background:#eef2ff;color:#312e81;font-size:13.5px;font-weight:700;line-height:1.4;text-align:center}' +
    '.pf-msg.ok{background:#dcfce7;color:#166534}.pf-msg.cash{background:#fef3c7;color:#92400e}.pf-msg.bad{background:#fee2e2;color:#b91c1c}' +
    '.pf-p2p{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 10px;padding:7px 14px;width:max-content;max-width:100%;box-sizing:border-box;border-radius:999px;background:#dcfce7;color:#166534;font:800 13px/1.3 inherit;font-family:inherit;text-align:center}' +
    '.pf-p2p small{display:block;font-weight:600;font-size:11.5px;opacity:.85}' +
    '#paymentBox>:not(.pf){display:none!important}' +
    'li[data-ou="pages"]{animation:ou-in .35s ease}@keyframes ou-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){li[data-ou="pages"]{animation:none}.pf-btn{transition:none}}';
  function addCss() { if ($('ou-css')) return; var s = document.createElement('style'); s.id = 'ou-css'; s.textContent = css; document.head.appendChild(s); }

  /* ---------------------------------------------------------------- 1. "Pages" row + page counter in the bottom bar */
  var forced = 0;
  var num = function (el) { var m = el && /\d+/.exec(el.textContent || ''); return m ? parseInt(m[0], 10) : 0; };
  function pageCount() {
    if (forced > 0) return forced;
    var n = num($('pg')) || num($('wzPg'));                                       // the bottom-bar counters of the print wizard / card wizard
    if (n > 0) return n;
    var t = ($('osum') || {}).textContent || ($('ocnt') || {}).textContent || '', m = /(\d+)\s*pages?/i.exec(t);   // cards order panel "4 pages"
    if (m && +m[1] > 0) return +m[1];
    var list = $('list'), sum = 0;                                                // last resort: add up "N pages" shown on each file row
    if (list) [].forEach.call(list.children, function (row) { var x = /(\d+)\s*(?:pages?|pgs?)\b/i.exec(row.textContent || ''); if (x) sum += +x[1]; });
    return sum;
  }
  function syncCounters(n) {                                                      // make sure "pages × copy" never shows a blank/0 count
    if (!(n > 0)) return;
    ['pg', 'wzPg'].forEach(function (id) { var e = $(id); if (e && e.textContent.trim() !== String(n)) e.textContent = n; });
  }
  var leaves = function (row) { return [].filter.call(row.querySelectorAll('*'), function (e) { return !e.children.length && (e.textContent || '').trim(); }); };
  var firstText = function (row) { for (var c = row.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.nodeValue.trim()) return c; return null; };
  function mkPagesRow(items, n) {
    var tpl = null;
    items.forEach(function (li) { if (!tpl && /^\s*copies/i.test(li.textContent || '')) tpl = li; });
    tpl = tpl || items[items.length - 1];
    var row = tpl.cloneNode(true); row.setAttribute('data-ou', 'pages'); row.removeAttribute('id');
    var lf = leaves(row);
    if (lf.length >= 2) { lf[0].textContent = 'Pages'; row._v = lf[lf.length - 1]; }
    else if (lf.length === 1 && firstText(row)) { firstText(row).nodeValue = 'Pages '; row._v = lf[0]; }
    else if (lf.length === 1) { lf[0].textContent = 'Pages'; row._v = document.createElement('b'); row.appendChild(row._v); }
    else { row.textContent = ''; var l = document.createElement('span'); l.textContent = 'Pages'; row._v = document.createElement('b'); row.appendChild(l); row.appendChild(row._v); }
    row._v.textContent = n;
    var files = null; items.forEach(function (li) { if (!files && /^\s*files?/i.test(li.textContent || '')) files = li; });
    if (files && files.parentNode) files.parentNode.insertBefore(row, files.nextSibling);
    else if (tpl.parentNode) tpl.parentNode.insertBefore(row, tpl);
    return row;
  }
  function fixRecaps() {
    var n = pageCount(); if (!(n > 0)) return;
    syncCounters(n);
    [].forEach.call(document.querySelectorAll('ul.recap'), function (ul) {
      var items = [].filter.call(ul.children, function (li) { return li.tagName === 'LI' && !li.hasAttribute('data-ou'); });
      var row = ul.querySelector('li[data-ou="pages"]');
      if (!items.length) { if (row) row.remove(); return; }                        // recap not rendered yet
      if (!row) {
        if (items.some(function (li) { return /^\s*(total\s+)?pages/i.test(li.textContent || ''); })) return;   // the page already has its own row
        mkPagesRow(items, n); return;
      }
      if (row._v && row._v.textContent !== String(n)) row._v.textContent = n;     // only touches the DOM when the value changed (no observer loop)
    });
  }

  /* ---------------------------------------------------------------- 2. order placed: Pay Now / Pay at Counter */
  var cur = { id: '', amount: 0, busy: false, st: null }, pollT = 0;
  var isP2P = function (id) { return /^P2P-/.test(String(id || '')); };
  var money = function (v) { v = Number(v) || 0; return RS + (Math.round(v * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 }); };
  function amountOf(d) {
    var t = (($('oamt') || {}).textContent || '') + ' ' + (($('odone') || {}).textContent || '') + ' ' + (d ? d.textContent : '');
    var m = /\u20B9\s*([\d,]+(?:\.\d+)?)/.exec(t); return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  }
  function say(text, kind) { var m = $('pfMsg'); if (!m) return; m.className = 'pf-msg' + (kind ? ' ' + kind : ''); m.textContent = text; m.hidden = !text; }
  function buildPF(box, oid, amt) {
    var pf = document.createElement('div'); pf.className = 'pf'; pf.id = 'payFlow';
    pf.innerHTML = '<div class="pf-h">How would you like to pay?</div>' +
      '<button type="button" class="pf-btn pf-now" id="pfNow"><i aria-hidden="true">\uD83D\uDCB3</i><span>Pay Now' + (amt > 0 ? ' \u00B7 ' + money(amt) : '') + '<small>Online with Razorpay \u2014 UPI, cards, netbanking</small></span></button>' +
      '<button type="button" class="pf-btn pf-cash" id="pfCash"><i aria-hidden="true">\uD83D\uDCB5</i><span>Pay at Counter<small>Pay cash at the shop when you collect your prints</small></span></button>' +
      '<div class="pf-msg" id="pfMsg" role="status" aria-live="polite" hidden></div>';
    box.appendChild(pf);
    $('pfNow').addEventListener('click', function () { payNow(); });
    $('pfCash').addEventListener('click', function () { payAtCounter(); });
  }
  function render(st) {                                                           // st = what /api/orders/:id answers
    if (!st || !$('pfNow')) return;
    cur.st = st;
    var now = $('pfNow'), cash = $('pfCash'), paid = st.pay_status === 'paid' || st.pay_status === 'cash_received';
    var dead = st.status === 'rejected' || st.status === 'expired';
    var moved = ['approved', 'printing', 'printed'].indexOf(st.status) >= 0;
    var amt = Number(st.amount) || cur.amount;
    now.hidden = cash.hidden = false;
    if (paid) {
      now.hidden = cash.hidden = true;
      say(st.pay_status === 'paid' ? '\u2705 Payment received online \u2014 ' + money(amt) + '. Thank you!' : '\u2705 Cash received at the counter \u2014 ' + money(amt) + '. Thank you!', 'ok');
    } else if (dead) {
      now.hidden = cash.hidden = true;
      say(st.status === 'expired' ? 'This order expired. Please start a new order.' : 'This order was cancelled by the shop.', 'bad');
    } else if (moved) {
      now.hidden = cash.hidden = true; say('', '');
    } else if (st.status === 'cash_wait') {
      cash.hidden = true;
      now.querySelector('span').firstChild.nodeValue = 'Pay Online Instead' + (amt > 0 ? ' \u00B7 ' + money(amt) : '');
      say('\uD83D\uDCB5 Please pay ' + money(amt) + ' in cash at the counter and show token ' + cur.id + '. Printing starts when the counter confirms.', 'cash');
    }
    if (st.note && !paid && !dead) say(st.note, 'bad');
  }
  function poll() {
    if (!cur.id) return;
    var id = cur.id;
    fetch('/api/orders/' + encodeURIComponent(id), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (st) { if (st && id === cur.id) render(st); }).catch(function () {});
  }
  function busy(on, which) {
    cur.busy = on;
    var a = $('pfNow'), b = $('pfCash'); if (a) a.disabled = on; if (b) b.disabled = on;
  }
  function jpost(url, body) {
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }

  function payAtCounter() {
    if (cur.busy || !cur.id) return;
    busy(true); say('Telling the counter\u2026', '');
    jpost('/api/orders/' + encodeURIComponent(cur.id) + '/pay-at-counter').then(function (r) {
      busy(false);
      if (!r.ok) { say((r.j && r.j.error) || 'Could not reach the counter. Please try again.', 'bad'); return; }
      poll(); setTimeout(poll, 1200);
      say('\uD83D\uDCB5 Pay ' + money(cur.amount) + ' in cash at the counter. Show token ' + cur.id + '.', 'cash');
    }).catch(function () { busy(false); say('Network problem. Please try again.', 'bad'); });
  }

  function payNow() {
    if (cur.busy || !cur.id) return;
    var id = cur.id;
    busy(true); say('Opening secure payment\u2026', '');
    loadRzp().then(function () { return jpost('/api/create-order', { orderId: id }); }).then(function (r) {
      var j = r.j || {};
      if (!r.ok || !j.order_id) throw new Error(j.error || 'Could not start the payment. Please try again.');
      var nm = (($('name') || $('sName') || $('ppName') || {}).value || '').trim(), ph = (($('phone') || $('sPhone') || $('ppPhone') || {}).value || '').replace(/\D/g, '');
      var rz = new window.Razorpay({
        key: j.key_id, amount: j.amount, currency: j.currency || 'INR', order_id: j.order_id, name: 'therajesh.shop', description: 'Print order ' + id,
        prefill: { name: nm, contact: /^\d{10}$/.test(ph) ? ph : '' }, theme: { color: '#2563eb' },
        modal: { ondismiss: function () { busy(false); say('Payment not completed. Tap Pay Now to try again, or choose Pay at Counter.', ''); } },
        handler: function (resp) {
          say('Confirming your payment\u2026', '');
          jpost('/api/verify-payment', { orderId: id, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature })
            .then(function (v) {
              busy(false);
              if (v.ok && v.j && v.j.success) { say('\u2705 Payment received \u2014 thank you! Your print is being prepared.', 'ok'); poll(); setTimeout(poll, 1200); }
              else say('We could not confirm the payment. If money was deducted, show token ' + id + ' at the counter.', 'bad');
            }).catch(function () { busy(false); say('We could not confirm the payment. If money was deducted, show token ' + id + ' at the counter.', 'bad'); });
        }
      });
      rz.on('payment.failed', function (e) { busy(false); say('Payment failed' + (e && e.error && e.error.description ? ': ' + e.error.description : '') + '. You can try again or choose Pay at Counter.', 'bad'); });
      allowUntil = Date.now() + 1500;                                              // the ONLY place where checkout is allowed to open
      rz.open();
    }).catch(function (e) { busy(false); say((e && e.message) || 'Could not start the payment. Please try again.', 'bad'); });
  }

  /* ---------------------------------------------------------------- 3. P2P badge + wiring when the order screen appears */
  function p2pBadge(d, oid) {
    var b = d.querySelector('.pf-p2p');
    if (isP2P(oid)) {
      if (b) return;
      b = document.createElement('div'); b.className = 'pf-p2p'; b.setAttribute('role', 'status');
      b.innerHTML = '<span aria-hidden="true">\u26A1</span><span>Transferred via P2P<small>Sent directly to the shop counter \u2014 not uploaded to a server</small></span>';
      d.insertBefore(b, d.firstChild);
    } else if (b) b.remove();
  }
  function ensureDone() {
    var d = $('done'), box = $('paymentBox');
    if (!d || !box || d.classList.contains('hidden')) return;
    var oid = (($('oid') || {}).textContent || '').trim(); if (!oid) return;
    p2pBadge(d, oid);
    var amt = amountOf(d);
    if (cur.id !== oid || !$('payFlow')) {
      cur = { id: oid, amount: amt, busy: false, st: null };
      var old = $('payFlow'); if (old) old.remove();
      buildPF(box, oid, amt);
      clearInterval(pollT); pollT = setInterval(poll, 4000); poll();
    } else if (amt > 0 && amt !== cur.amount) { cur.amount = amt; var s = $('pfNow') && $('pfNow').querySelector('span'); if (s && s.firstChild) s.firstChild.nodeValue = 'Pay Now \u00B7 ' + money(amt); }
  }

  /* ---------------------------------------------------------------- driver */
  var raf = 0;
  function tick() { raf = 0; try { fixRecaps(); ensureDone(); } catch (e) {} }
  function schedule() { if (!raf) raf = (window.requestAnimationFrame || setTimeout)(tick); }
  function init() {
    addCss();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('input', schedule, true);
    document.addEventListener('click', schedule, true);
    schedule();
  }
  window.OrderUI = { setPages: function (n) { forced = Math.max(0, parseInt(n, 10) || 0); schedule(); }, refresh: schedule };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
