/* therajesh.shop — wizard.js
   Tiny shared controller for the multi-step bottom-sheet wizard, generic modals,
   copies steppers and body scroll-lock. No dependencies. Page scripts register their flows:
     Wiz.register('doc', {steps:3, titles:[...], guard:(from,to)=>true})
   Optional flow settings: home (step a flow opens on, default 1; steps below it are optional
   "side" views that get a back button returning home) and hideSteps (hide the "Step n of N" label + progress bar).
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
    r.classList.toggle('wz-nosteps', !!f.hideSteps);
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
    sync: sync, showDone: showDone, mirror: mirror, modal: modal,
    isOpen: function () { return st.open; }, step: function () { return st.step; }, flow: function () { return st.flow; }
  };

  function init() { initHeader(); watchLock(); hashModal(); updateResume(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
