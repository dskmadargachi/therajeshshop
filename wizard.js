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
    build(); clearTimeout(hideT);
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
