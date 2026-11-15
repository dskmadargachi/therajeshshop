/* therajesh.shop — voice-alerts.js
   Bangla female voice alerts with a soft chime in front.

     ShopVoice.paymentSuccess()  "পেমেন্ট সাকসেসফুল"
     ShopVoice.printing()        "প্রিন্ট হচ্ছে"
     ShopVoice.printComplete()   "আপনার প্রিন্ট কমপ্লিট হয়েছে, কাউন্টার থেকে নিয়ে যান"

   Each alert = chime  ->  /sounds/<file>.mp3 if that file exists  ->  otherwise browser Bangla text-to-speech
   (bn-IN / bn-BD, a female voice is preferred). Put recorded files in /sounds/ :
        payment-success.mp3   printing.mp3   print-complete.mp3

   Also:  ShopVoice.enabled() / setEnabled(bool) / unlock() / test() / trackOrder(id, order)
   Any <button data-voice-toggle> is the mute switch, <button data-voice-test> the test button; if a page has none, a
   speaker chip is added to the header automatically.  Audio is unlocked on the visitor's first tap/click/key press
   (needed by mobile Chrome / Safari); an alert that fires before that is held and played right after the first tap. */
(function () {
  'use strict';
  if (window.ShopVoice) return;

  var MSG = {
    paymentSuccess: { text: 'পেমেন্ট সাকসেসফুল', file: '/sounds/payment-success.mp3' },
    printing:       { text: 'প্রিন্ট হচ্ছে', file: '/sounds/printing.mp3' },
    printComplete:  { text: 'আপনার প্রিন্ট কমপ্লিট হয়েছে, কাউন্টার থেকে নিয়ে যান', file: '/sounds/print-complete.mp3' }
  };
  var KEY = 'shopvoice:on', DEDUPE_MS = 30000, PENDING_MS = 90000;
  var SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var on = lsGet(KEY) !== '0';           // default: ON
  var unlocked = false, actx = null, audioEl = null;
  var queue = [], busy = false, pending = {}, lastAt = {}, mp3 = {}, voice = null, voicesReady = false;
  var tracked = {};

  /* ---------------------------------------------------------------- audio unlock ---------------------------------------------------------------- */
  function ctx() {
    if (actx) return actx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { actx = new AC(); } catch (e) { actx = null; }
    return actx;
  }
  function el() {
    if (audioEl) return audioEl;
    try { audioEl = new Audio(); audioEl.preload = 'auto'; } catch (e) { audioEl = null; }
    return audioEl;
  }
  function unlock() {
    var c = ctx();
    try {
      if (c) {
        if (c.state === 'suspended') c.resume();
        var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();    // 1 silent sample: iOS/Safari unlock
        s.buffer = b; s.connect(c.destination); s.start(0);
      }
    } catch (e) {}
    try {
      var a = el();                                                           // the SAME element plays every mp3 later
      if (a && !a._unl) { a._unl = 1; a.src = SILENT_WAV; var p = a.play(); if (p && p.then) p.then(function () { a.pause(); }, function () {}); }
    } catch (e) {}
    try {
      if (window.speechSynthesis && !unlock._s) {                             // an empty, silent utterance inside the gesture
        unlock._s = 1; var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u);
      }
    } catch (e) {}
    if (!unlocked) { unlocked = true; flushPending(); }
  }
  ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function () { unlock(); }, { capture: true, passive: true });
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && actx && actx.state === 'suspended') { try { actx.resume(); } catch (e) {} } });

  /* ---------------------------------------------------------------- chime ---------------------------------------------------------------- */
  function chime() {
    return new Promise(function (resolve) {
      var c = ctx();
      if (!c) return resolve();
      try {
        if (c.state === 'suspended') c.resume();
        var t0 = c.currentTime + 0.02, notes = [[659.25, 0], [783.99, 0.15], [1046.5, 0.30]];   // E5 - G5 - C6, a gentle rising bell
        notes.forEach(function (n) {
          [[1, 0.20, 'sine'], [2, 0.05, 'triangle']].forEach(function (h) {
            var o = c.createOscillator(), g = c.createGain();
            o.type = h[2]; o.frequency.value = n[0] * h[0]; o.connect(g); g.connect(c.destination);
            var t = t0 + n[1];
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(h[1], t + 0.03);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
            o.start(t); o.stop(t + 0.8);
          });
        });
        setTimeout(resolve, 1000);
      } catch (e) { resolve(); }
    });
  }

  /* ---------------------------------------------------------------- recorded mp3 (optional) ---------------------------------------------------------------- */
  function hasMp3(kind) {
    if (mp3[kind] !== undefined) return Promise.resolve(mp3[kind] === true || mp3[kind].ok === true);
    if (!mp3['p:' + kind]) {
      mp3['p:' + kind] = fetch(MSG[kind].file, { method: 'HEAD', cache: 'no-cache' }).then(function (r) {
        // a static host may answer an unknown path with index.html (HTTP 200) - only a real audio file counts
        var ct = (r.headers.get('content-type') || '').toLowerCase();
        mp3[kind] = { ok: !!(r.ok && (ct.indexOf('audio') === 0 || ct.indexOf('mpeg') > -1 || ct.indexOf('octet-stream') > -1)) };
        return mp3[kind].ok;
      }, function () { mp3[kind] = { ok: false }; return false; });
    }
    return mp3['p:' + kind];
  }
  function playMp3(file) {
    return new Promise(function (resolve) {
      var a = el(); if (!a) return resolve(false);
      var done = false, t;
      function end(ok) { if (done) return; done = true; clearTimeout(t); a.onended = a.onerror = null; resolve(ok); }
      a.onended = function () { end(true); };
      a.onerror = function () { end(false); };
      t = setTimeout(function () { try { a.pause(); } catch (e) {} end(false); }, 20000);
      try { a.src = file; a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () { end(false); }); } catch (e) { end(false); }
    });
  }

  /* ---------------------------------------------------------------- browser Bangla text-to-speech ---------------------------------------------------------------- */
  var MALE = /\b(male|man|bashkar|pradeep|hemant|prabhat|kalpana_?m)\b/i, FEMALE = /(female|woman|tanishaa|nabanita|swara|ananya|aditi|google)/i;
  function pickVoice() {
    if (!window.speechSynthesis) return null;
    var all = [];
    try { all = speechSynthesis.getVoices() || []; } catch (e) {}
    var bn = all.filter(function (v) { return /^bn([-_]|$)/i.test(v.lang || '') || /bengali|bangla/i.test(v.name || ''); });
    if (!bn.length) return null;
    function score(v) {
      var s = 0, n = v.name || '', l = (v.lang || '').replace('_', '-').toLowerCase();
      if (FEMALE.test(n)) s += 6;
      if (MALE.test(n)) s -= 8;
      if (/natural|online|neural/i.test(n)) s += 2;
      if (l === 'bn-in') s += 2; else if (l === 'bn-bd') s += 1;
      if (v.localService === false) s += 0.5;
      return s;
    }
    bn.sort(function (a, b) { return score(b) - score(a); });
    return bn[0];
  }
  function loadVoices() { voice = pickVoice(); voicesReady = true; }
  if (window.speechSynthesis) {
    loadVoices();
    try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { speechSynthesis.onvoiceschanged = loadVoices; }
  }
  function speak(text) {
    return new Promise(function (resolve) {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return resolve(false);
      var done = false, t, started = false;
      function end(ok) { if (done) return; done = true; clearTimeout(t); resolve(ok); }
      try {
        if (!voice) voice = pickVoice();
        speechSynthesis.cancel(); try { speechSynthesis.resume(); } catch (e) {}
        var u = new SpeechSynthesisUtterance(text);
        u.lang = (voice && voice.lang) || 'bn-IN'; if (voice) u.voice = voice;
        var femaleNamed = voice && FEMALE.test(voice.name || '');
        u.rate = 0.92; u.pitch = femaleNamed ? 1.05 : 1.3; u.volume = 1;     // no female bn voice installed -> raise the pitch a little
        u.onstart = function () { started = true; };
        u.onend = function () { end(true); };
        u.onerror = function () { end(false); };
        t = setTimeout(function () { end(started); }, 14000);
        setTimeout(function () { speechSynthesis.speak(u); }, 60);            // small gap after cancel(): avoids a Chrome race that drops the utterance
      } catch (e) { end(false); }
    });
  }

  /* ---------------------------------------------------------------- queue ---------------------------------------------------------------- */
  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    var job = queue.shift();
    paintTalk(true);
    chime().then(function () {
      return hasMp3(job.kind).then(function (ok) { return ok ? playMp3(MSG[job.kind].file) : false; });
    }).then(function (played) { return played ? true : speak(MSG[job.kind].text); })
      .then(function () {}, function () {})
      .then(function () { busy = false; paintTalk(queue.length > 0); pump(); });
  }
  function enqueue(kind, opts) {
    opts = opts || {};
    if (!MSG[kind]) return false;
    if (!on && !opts.force) return false;
    var now = Date.now(), key = kind + (opts.id ? ':' + opts.id : '');
    if (!opts.force && lastAt[key] && now - lastAt[key] < DEDUPE_MS) return false;   // same alert for the same order within 30 s -> once
    lastAt[key] = now;
    if (!unlocked) { pending[kind] = { opts: opts, at: now }; return true; }        // no tap yet: keep it, play right after the first tap
    queue.push({ kind: kind }); pump();
    return true;
  }
  function flushPending() {
    var now = Date.now();
    Object.keys(pending).forEach(function (k) { var p = pending[k]; delete pending[k]; if (now - p.at < PENDING_MS && on) { queue.push({ kind: k }); } });
    pump();
  }

  /* ---------------------------------------------------------------- toggle / test buttons ---------------------------------------------------------------- */
  function paint() {
    [].forEach.call(document.querySelectorAll('[data-voice-toggle]'), function (b) {
      b.textContent = on ? '🔊' : '🔇';
      b.classList.toggle('off', !on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = on ? 'Voice alerts ON — tap to mute / ভয়েস অ্যালার্ট চালু, বন্ধ করতে চাপুন' : 'Voice alerts MUTED — tap to turn on / ভয়েস অ্যালার্ট বন্ধ, চালু করতে চাপুন';
      b.setAttribute('aria-label', b.title);
    });
  }
  function paintTalk(v) { [].forEach.call(document.querySelectorAll('[data-voice-toggle]'), function (b) { b.classList.toggle('talk', !!v && on); }); }
  function setEnabled(v) {
    on = !!v; lsSet(KEY, on ? '1' : '0');
    if (!on) { queue.length = 0; pending = {}; try { speechSynthesis.cancel(); } catch (e) {} try { if (audioEl) audioEl.pause(); } catch (e) {} paintTalk(false); }
    paint();
    try { window.dispatchEvent(new CustomEvent('shopvoice:change', { detail: { enabled: on } })); } catch (e) {}
  }
  function test() {
    unlock();
    if (!on) setEnabled(true);
    ['paymentSuccess', 'printing', 'printComplete'].forEach(function (k) { enqueue(k, { force: true }); });
  }
  function mount() {
    var css = document.createElement('style');
    css.textContent = '.vs-btn{cursor:pointer;font:inherit;line-height:1.35;-webkit-tap-highlight-color:transparent}' +
      'button.chip.vs-btn{padding:2px 10px!important;font-size:13px!important}' +
      '.vs-btn.off{opacity:.65}.vs-btn.talk{animation:vsPulse 1s ease-in-out infinite}' +
      '@keyframes vsPulse{50%{transform:scale(1.14)}}@media (prefers-reduced-motion:reduce){.vs-btn.talk{animation:none}}';
    document.head.appendChild(css);
    var has = document.querySelector('[data-voice-toggle]');
    if (!has) {
      var host = document.querySelector('.topbar .chips') || document.querySelector('.top-actions') || document.querySelector('.topbar-in');
      if (host) {
        var b = document.createElement('button');
        b.type = 'button'; b.setAttribute('data-voice-toggle', ''); b.className = 'vs-btn' + (host.classList.contains('chips') ? ' chip' : '');
        host.appendChild(b);
      }
    }
    [].forEach.call(document.querySelectorAll('[data-voice-toggle]'), function (b) { b.classList.add('vs-btn'); });
    paint();
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-voice-toggle],[data-voice-test]');
    if (!t) return;
    unlock();
    if (t.hasAttribute('data-voice-test')) { test(); return; }
    setEnabled(!on);
    if (on) chime();                                                        // short chime = confirms that sound works right now
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  setTimeout(function () { Object.keys(MSG).forEach(function (k) { hasMp3(k); }); }, 1500);   // find out early which mp3 files exist

  /* ---------------------------------------------------------------- order tracking (customer pages) ----------------------------------------------------------------
     Feed every poll result of an order:  ShopVoice.trackOrder(id, order).
     It speaks once per real change: not-paid -> paid, status -> printing, status -> printed.  The first reading of an order is only a
     baseline, so reloading a page never replays old alerts. */
  function isPaid(o) { return o && (o.pay_status === 'paid' || o.pay_status === 'cash_received'); }
  function trackOrder(id, o) {
    if (!o || id == null) return;
    var paid = !!isPaid(o), st = o.status, p = tracked[id];
    if (p) {
      if (!p.paid && paid) enqueue('paymentSuccess', { id: id });
      if (st !== p.st) {
        if (st === 'printed') enqueue('printComplete', { id: id });
        else if (st === 'printing') enqueue('printing', { id: id });
      }
    }
    tracked[id] = { paid: paid, st: st };
  }

  window.ShopVoice = {
    paymentSuccess: function (o) { return enqueue('paymentSuccess', o); },
    printing: function (o) { return enqueue('printing', o); },
    printComplete: function (o) { return enqueue('printComplete', o); },
    trackOrder: trackOrder,
    enabled: function () { return on; },
    setEnabled: setEnabled,
    unlock: unlock,
    test: test,
    messages: MSG
  };
})();
