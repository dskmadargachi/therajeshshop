/* therajesh.shop — scan-wizard.js
   Full-screen dark Smart Scanner popup wizard.
   Steps: 1 type -> 2 source -> 3 perspective crop (auto 4-corner detection + homography warp) -> 4 side confirmation -> A4 composition.
   No dependencies. OpenCV.js is used for edge detection only when the page already loaded it (window.cv);
   otherwise a built-in canvas edge finder runs. The warp itself is pure JS (works everywhere).

   Usage:  SmartScan.open();
           SmartScan.onDone = function (res) { res.pages  -> array of A4 canvases (2480 x 3508, .eff = 300)
                                               res.label  -> 'ID card' | 'Certificate' | 'Admit card / Marksheet'
                                               res.layout -> 'id' | 'cert' | 'admit' } */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ text (English / বাংলা) */
  var TXT = {
    en: {
      title: 'Auto Crop Aadhaar PAN Voter',
      'type.q': 'What are you scanning?',
      'type.s': 'Pick the right type. After the crop, your document is placed in a ready-to-print layout.',
      'id.t': 'ID Card', 'id.s': 'Aadhaar · PAN · Voter · DL — front & back side-by-side on one A4 page',
      'cert.t': 'Certificate', 'cert.s': 'Full A4 document — marksheet, certificate, letter',
      'admit.t': 'Admit Card / Marksheet', 'admit.s': 'Half page — front on top half, back on bottom half of one A4 page',
      'auto.t': 'Auto', 'auto.s': 'System automatically detects document proportions',
      'src.q': 'Where to take the photo from?',
      'src.s': 'A flat, well-lit photo gives the cleanest result. Both ways are straightened automatically.',
      'cam.t': 'Camera', 'cam.s': 'Take a photo now — keep the document in front of you',
      'file.t': 'Files', 'file.s': 'Choose a photo already saved on your phone or computer',
      back: '‹ Back', close: 'Close',
      'crop.t': '📐 Perspective Crop',
      'crop.s': 'Drag the 4 corners to the document’s corners — even a tilted photo becomes straight',
      cancel: '✕ Cancel', full: '↔ Full Photo', crop: '✓ Crop',
      detecting: 'Finding the edges…', processing: 'Straightening…',
      'ok.front': 'Front side done', 'ok.back': 'Back side done', 'ok.both': 'Both sides ready',
      'ok.hint': 'That’s all? Tap Print. If the other side is printed too, add it below.',
      rotate: '🔄 Rotate (90°)', rotF: '🔄 Rotate front', rotB: '🔄 Rotate back',
      done: '✅ Done — Go to Print', addback: '➕ Add Back Side',
      side_front: 'Front', side_back: 'Back', backFor: 'Back side',
      readErr: 'Could not read this image. Try another photo.',
      lblid: 'ID card', lblcert: 'Certificate', lbladmit: 'Admit card / Marksheet'
    },
    bn: {
      title: 'অটো ক্রপ আধার প্যান ভোটার',
      'type.q': 'আপনি কী স্ক্যান করছেন?',
      'type.s': 'সঠিক টাইপ বাছুন। ক্রপের পর ডকুমেন্ট প্রিন্টের উপযোগী লেআউটে বসে যাবে।',
      'id.t': 'আইডি কার্ড', 'id.s': 'আধার · প্যান · ভোটার · ডিএল — সামনে ও পেছন একই A4 পাতায় পাশাপাশি',
      'cert.t': 'সার্টিফিকেট', 'cert.s': 'পুরো A4 ডকুমেন্ট — মার্কশিট, সার্টিফিকেট, চিঠি',
      'admit.t': 'অ্যাডমিট কার্ড / মার্কশিট', 'admit.s': 'আধা পাতা — সামনে উপরের অর্ধেকে, পেছন নিচের অর্ধেকে',
      'auto.t': 'অটো', 'auto.s': 'সিস্টেম নিজেই ডকুমেন্টের মাপ চিনে নেবে',
      'src.q': 'ছবি কোথা থেকে নেবেন?',
      'src.s': 'সমান জায়গায়, ভালো আলোয় তোলা ছবিতে ফলাফল সবচেয়ে পরিষ্কার হয়। দুই পথেই ছবি নিজে সোজা হয়ে যায়।',
      'cam.t': 'ক্যামেরা', 'cam.s': 'এখনই ছবি তুলুন — ডকুমেন্ট সামনে রাখুন',
      'file.t': 'ফাইল', 'file.s': 'ফোন বা কম্পিউটারে আগে থেকে রাখা ছবি বাছুন',
      back: '‹ পেছনে', close: 'বন্ধ করুন',
      'crop.t': '📐 পার্সপেক্টিভ ক্রপ',
      'crop.s': 'ডকুমেন্টের ৪টি কোনা টেনে ঠিক জায়গায় বসান — ছবি বাঁকা হলেও সোজা হয়ে যাবে',
      cancel: '✕ বাতিল', full: '↔ পুরো ছবি', crop: '✓ ক্রপ',
      detecting: 'কিনারা খোঁজা হচ্ছে…', processing: 'সোজা করা হচ্ছে…',
      'ok.front': 'সামনের দিক হয়ে গেছে', 'ok.back': 'পেছনের দিক হয়ে গেছে', 'ok.both': 'দুই দিকই তৈরি',
      'ok.hint': 'এটুকুই হলে প্রিন্ট বাটন চাপুন। উল্টো পাশেও ছাপা থাকলে নিচ থেকে যোগ করুন।',
      rotate: '🔄 ঘোরান (৯০°)', rotF: '🔄 সামনে ঘোরান', rotB: '🔄 পেছন ঘোরান',
      done: '✅ হয়ে গেছে — প্রিন্ট করুন', addback: '➕ পেছনের দিক যোগ করুন',
      side_front: 'সামনে', side_back: 'পেছন', backFor: 'পেছনের দিক',
      readErr: 'এই ছবিটি পড়া গেল না। অন্য ছবি চেষ্টা করুন।',
      lblid: 'আইডি কার্ড', lblcert: 'সার্টিফিকেট', lbladmit: 'অ্যাডমিট কার্ড / মার্কশিট'
    }
  };
  function lang() { return document.documentElement.lang === 'bn' ? 'bn' : 'en'; }
  function t(k) { return (TXT[lang()] && TXT[lang()][k]) || TXT.en[k] || k; }

  /* ------------------------------------------------------------------ geometry (pure functions) */
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  /* order 4 points as TL, TR, BR, BL */
  function orderQuad(p) {
    var bySum = p.slice().sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    var byDiff = p.slice().sort(function (a, b) { return (a.x - a.y) - (b.x - b.y); });
    var tl = bySum[0], br = bySum[3], bl = byDiff[0], tr = byDiff[3];
    return [tl, tr, br, bl];
  }

  /* solve homography H that maps P[i] -> Q[i] (4 point pairs). Returns 8 numbers h0..h7 (h8 = 1). */
  function solveH(P, Q) {
    var A = [], i, j, k;
    for (i = 0; i < 4; i++) {
      var x = P[i].x, y = P[i].y, X = Q[i].x, Y = Q[i].y;
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X]);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y]);
    }
    for (i = 0; i < 8; i++) {                                   // Gauss-Jordan with partial pivoting
      var m = i;
      for (j = i + 1; j < 8; j++) if (Math.abs(A[j][i]) > Math.abs(A[m][i])) m = j;
      var tmp = A[i]; A[i] = A[m]; A[m] = tmp;
      if (Math.abs(A[i][i]) < 1e-12) return null;
      for (j = i + 1; j < 8; j++) {
        var f = A[j][i] / A[i][i];
        for (k = i; k < 9; k++) A[j][k] -= f * A[i][k];
      }
    }
    var h = new Array(8);
    for (i = 7; i >= 0; i--) {
      var s = A[i][8];
      for (j = i + 1; j < 8; j++) s -= A[i][j] * h[j];
      h[i] = s / A[i][i];
    }
    return h;
  }
  function applyH(h, x, y) {
    var d = h[6] * x + h[7] * y + 1;
    return { x: (h[0] * x + h[1] * y + h[2]) / d, y: (h[3] * x + h[4] * y + h[5]) / d };
  }

  function newCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

  /* perspective warp: the quad (TL,TR,BR,BL in src pixels) becomes a flat W x H rectangle */
  function warp(src, quad, W, H) {
    var sw = src.width, sh = src.height;
    var h = solveH([{ x: 0, y: 0 }, { x: W - 1, y: 0 }, { x: W - 1, y: H - 1 }, { x: 0, y: H - 1 }], quad);
    if (!h) throw new Error('warp');
    var sd = src.getContext('2d').getImageData(0, 0, sw, sh).data;
    var out = newCanvas(W, H), octx = out.getContext('2d'), od = octx.createImageData(W, H), o = od.data;
    var h0 = h[0], h1 = h[1], h2 = h[2], h3 = h[3], h4 = h[4], h5 = h[5], h6 = h[6], h7 = h[7];
    var maxX = sw - 1.001, maxY = sh - 1.001, p = 0, x, y;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        var d = h6 * x + h7 * y + 1;
        var sx = (h0 * x + h1 * y + h2) / d, sy = (h3 * x + h4 * y + h5) / d;
        if (sx < 0) sx = 0; else if (sx > maxX) sx = maxX;
        if (sy < 0) sy = 0; else if (sy > maxY) sy = maxY;
        var x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
        var i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
        var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        o[p] = sd[i00] * w00 + sd[i10] * w10 + sd[i01] * w01 + sd[i11] * w11;
        o[p + 1] = sd[i00 + 1] * w00 + sd[i10 + 1] * w10 + sd[i01 + 1] * w01 + sd[i11 + 1] * w11;
        o[p + 2] = sd[i00 + 2] * w00 + sd[i10 + 2] * w10 + sd[i01 + 2] * w01 + sd[i11 + 2] * w11;
        o[p + 3] = 255; p += 4;
      }
    }
    octx.putImageData(od, 0, 0);
    return out;
  }

  /* ------------------------------------------------------------------ automatic edge detection */
  function defaultQuad(w, h) {
    var mx = w * 0.1, my = h * 0.1;
    return [{ x: mx, y: my }, { x: w - mx, y: my }, { x: w - mx, y: h - my }, { x: mx, y: h - my }];
  }
  function fullQuad(w, h) { return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]; }

  /* OpenCV path: Canny -> findContours -> approxPolyDP, biggest convex 4-point contour */
  function cvQuad(c) {
    var cv = window.cv; if (!cv || !cv.Mat) return null;
    var s = Math.min(1, 800 / Math.max(c.width, c.height)), w = Math.round(c.width * s), h = Math.round(c.height * s);
    var tc = newCanvas(w, h); tc.getContext('2d').drawImage(c, 0, 0, w, h);
    var src = cv.imread(tc), g = new cv.Mat(), b = new cv.Mat(), e = new cv.Mat(), k = cv.Mat.ones(5, 5, cv.CV_8U);
    var cs = new cv.MatVector(), hi = new cv.Mat(), best = null, bestA = 0;
    try {
      cv.cvtColor(src, g, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(g, b, new cv.Size(5, 5), 0);
      cv.Canny(b, e, 40, 120);
      cv.dilate(e, e, k);
      cv.findContours(e, cs, hi, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
      for (var i = 0; i < cs.size(); i++) {
        var cnt = cs.get(i), area = cv.contourArea(cnt);
        if (area > w * h * 0.12 && area < w * h * 0.97 && area > bestA) {
          var ap = new cv.Mat(), peri = cv.arcLength(cnt, true);
          cv.approxPolyDP(cnt, ap, 0.02 * peri, true);
          if (ap.rows === 4 && cv.isContourConvex(ap)) {
            bestA = area; best = [];
            for (var j = 0; j < 4; j++) best.push({ x: ap.data32S[j * 2] / s, y: ap.data32S[j * 2 + 1] / s });
          }
          ap.delete();
        }
        cnt.delete();
      }
    } finally { src.delete(); g.delete(); b.delete(); e.delete(); k.delete(); cs.delete(); hi.delete(); }
    return best ? orderQuad(best) : null;
  }

  /* Canvas path: colour distance from the border colour -> Otsu -> largest blob -> 4 extreme corners */
  function edgeQuad(c) {
    var s = Math.min(1, 360 / Math.max(c.width, c.height)), w = Math.max(8, Math.round(c.width * s)), h = Math.max(8, Math.round(c.height * s));
    var tc = newCanvas(w, h), x = tc.getContext('2d'); x.drawImage(c, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h).data, i, xx, yy;
    var rs = [], gs = [], bs = [];
    function samp(px, py) { var p = (py * w + px) * 4; rs.push(d[p]); gs.push(d[p + 1]); bs.push(d[p + 2]); }
    for (xx = 2; xx < w - 2; xx++) { samp(xx, 2); samp(xx, h - 3); }
    for (yy = 2; yy < h - 2; yy++) { samp(2, yy); samp(w - 3, yy); }
    function med(a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1]; }
    var br = med(rs), bg = med(gs), bb = med(bs);
    var diff = new Uint8Array(w * h), hist = new Array(256).fill(0);
    for (i = 0; i < w * h; i++) {
      var v = Math.min(255, (Math.abs(d[i * 4] - br) + Math.abs(d[i * 4 + 1] - bg) + Math.abs(d[i * 4 + 2] - bb)) / 3 * 1.6) | 0;
      diff[i] = v; hist[v]++;
    }
    var total = w * h, sumAll = 0, wB = 0, sumB = 0, thr = 40, maxV = -1;       // Otsu
    for (i = 0; i < 256; i++) sumAll += i * hist[i];
    for (i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue; var wF = total - wB; if (!wF) break;
      sumB += i * hist[i]; var mB = sumB / wB, mF = (sumAll - sumB) / wF, vb = wB * wF * (mB - mF) * (mB - mF);
      if (vb > maxV) { maxV = vb; thr = i; }
    }
    thr = Math.max(thr, 28);
    var lab = new Int32Array(w * h), bestL = 0, bestN = 0, L = 0, stack = new Int32Array(w * h);
    for (i = 0; i < w * h; i++) {
      if (diff[i] <= thr || lab[i]) continue;
      L++; var sp = 0, n = 0; stack[sp++] = i; lab[i] = L;
      while (sp) {
        var q = stack[--sp]; n++;
        var qx = q % w, qy = (q / w) | 0, nb;
        if (qx > 0 && diff[nb = q - 1] > thr && !lab[nb]) { lab[nb] = L; stack[sp++] = nb; }
        if (qx < w - 1 && diff[nb = q + 1] > thr && !lab[nb]) { lab[nb] = L; stack[sp++] = nb; }
        if (qy > 0 && diff[nb = q - w] > thr && !lab[nb]) { lab[nb] = L; stack[sp++] = nb; }
        if (qy < h - 1 && diff[nb = q + w] > thr && !lab[nb]) { lab[nb] = L; stack[sp++] = nb; }
      }
      if (n > bestN) { bestN = n; bestL = L; }
    }
    if (bestN < total * 0.08 || bestN > total * 0.92) return null;
    var tl = null, tr = null, brc = null, bl = null, a, b2;
    var mnS = 1e9, mxS = -1e9, mnD = 1e9, mxD = -1e9;
    for (i = 0; i < total; i++) {
      if (lab[i] !== bestL) continue;
      var px = i % w, py = (i / w) | 0; a = px + py; b2 = px - py;
      if (a < mnS) { mnS = a; tl = { x: px, y: py }; }
      if (a > mxS) { mxS = a; brc = { x: px, y: py }; }
      if (b2 < mnD) { mnD = b2; bl = { x: px, y: py }; }
      if (b2 > mxD) { mxD = b2; tr = { x: px, y: py }; }
    }
    var q4 = [tl, tr, brc, bl].map(function (p) { return { x: p.x / s, y: p.y / s }; });
    if (dist(q4[0], q4[1]) < 20 || dist(q4[1], q4[2]) < 20 || dist(q4[2], q4[3]) < 20 || dist(q4[3], q4[0]) < 20) return null;
    return q4;
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frame() { return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); }); }

  async function detectQuad(c) {
    var q = null;
    try {
      if (!(window.cv && window.cv.Mat) && typeof window.cvReady === 'function') {
        try { await Promise.race([window.cvReady(), sleep(2500)]); } catch (e) { /* ignore */ }
      }
      if (window.cv && window.cv.Mat) q = cvQuad(c);
    } catch (e) { q = null; }
    if (!q) { try { q = edgeQuad(c); } catch (e) { q = null; } }
    return q || defaultQuad(c.width, c.height);
  }

  /* ------------------------------------------------------------------ scan enhancement */
  function boxBlur(a, w, h, r) {                       // single channel Float32, separable, edge clamped
    var tmp = new Float32Array(w * h), x, y, k, acc, n = 2 * r + 1;
    for (y = 0; y < h; y++) {
      acc = 0; for (k = -r; k <= r; k++) acc += a[y * w + Math.min(w - 1, Math.max(0, k))];
      for (x = 0; x < w; x++) {
        tmp[y * w + x] = acc / n;
        acc += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
      }
    }
    var out = new Float32Array(w * h);
    for (x = 0; x < w; x++) {
      acc = 0; for (k = -r; k <= r; k++) acc += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (y = 0; y < h; y++) {
        out[y * w + x] = acc / n;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }
  function maxFilter(a, w, h, r) {
    var tmp = new Float32Array(w * h), out = new Float32Array(w * h), x, y, k, m;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      m = 0; for (k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) if (a[y * w + k] > m) m = a[y * w + k];
      tmp[y * w + x] = m;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      m = 0; for (k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) if (tmp[k * w + x] > m) m = tmp[k * w + x];
      out[y * w + x] = m;
    }
    return out;
  }

  /* document: remove shadows / paper colour (divide by estimated paper brightness), then crisp contrast + light sharpen */
  function enhanceDoc(c) {
    var w = c.width, h = c.height, s = Math.min(1, 220 / Math.max(w, h)), sw = Math.max(4, Math.round(w * s)), sh = Math.max(4, Math.round(h * s));
    var sc = newCanvas(sw, sh); sc.getContext('2d').drawImage(c, 0, 0, sw, sh);
    var sd = sc.getContext('2d').getImageData(0, 0, sw, sh).data, ch = [0, 1, 2].map(function () { return new Float32Array(sw * sh); }), i, k;
    for (i = 0; i < sw * sh; i++) for (k = 0; k < 3; k++) ch[k][i] = sd[i * 4 + k];
    var r1 = Math.max(3, Math.round(sw / 22)), r2 = Math.max(2, Math.round(sw / 30));
    var bgc = newCanvas(sw, sh), bctx = bgc.getContext('2d'), bimg = bctx.createImageData(sw, sh);
    var bgch = ch.map(function (a) { return boxBlur(maxFilter(a, sw, sh, r1), sw, sh, r2); });
    for (i = 0; i < sw * sh; i++) { for (k = 0; k < 3; k++) bimg.data[i * 4 + k] = Math.max(1, Math.min(255, bgch[k][i])); bimg.data[i * 4 + 3] = 255; }
    bctx.putImageData(bimg, 0, 0);
    var big = newCanvas(w, h), gctx = big.getContext('2d'); gctx.imageSmoothingQuality = 'high'; gctx.drawImage(bgc, 0, 0, w, h);
    var bd = gctx.getImageData(0, 0, w, h).data, ctx = c.getContext('2d'), id = ctx.getImageData(0, 0, w, h), d = id.data;
    for (i = 0; i < w * h; i++) {
      var p = i * 4;
      for (k = 0; k < 3; k++) {
        var v = d[p + k] * 255 / Math.max(40, bd[p + k]);
        v = (v - 22) * 1.12; d[p + k] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    var src = new Uint8ClampedArray(d), amt = 0.55, x, y;                     // light unsharp (3x3 cross)
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      var q = (y * w + x) * 4;
      for (k = 0; k < 3; k++) {
        var cen = src[q + k], nb = (src[q - 4 + k] + src[q + 4 + k] + src[q - w * 4 + k] + src[q + w * 4 + k]) / 4;
        var v2 = cen + amt * (cen - nb); d[q + k] = v2 < 0 ? 0 : v2 > 255 ? 255 : v2;
      }
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }
  /* ID card photo: gentle auto-levels so colours stay natural */
  function enhanceId(c) {
    var w = c.width, h = c.height, ctx = c.getContext('2d'), id = ctx.getImageData(0, 0, w, h), d = id.data, hist = new Array(256).fill(0), i, n = w * h;
    for (i = 0; i < n; i++) hist[(d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) | 0]++;
    var lo = 0, hi = 255, acc = 0;
    for (i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.01) { lo = i; break; } }
    acc = 0; for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.01) { hi = i; break; } }
    if (hi - lo < 60) return c;
    lo = Math.min(lo, 70); hi = Math.max(hi, 185);
    var sc = 255 / (hi - lo);
    for (i = 0; i < n; i++) {
      var p = i * 4, r = (d[p] - lo) * sc, g = (d[p + 1] - lo) * sc, b = (d[p + 2] - lo) * sc, l = r * 0.3 + g * 0.59 + b * 0.11;
      r = l + (r - l) * 1.08; g = l + (g - l) * 1.08; b = l + (b - l) * 1.08;
      d[p] = r < 0 ? 0 : r > 255 ? 255 : r; d[p + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[p + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  function rotateCW(c) {
    var o = newCanvas(c.height, c.width), x = o.getContext('2d');
    x.translate(o.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0);
    return o;
  }
  function isIdLike(c) { var r = Math.max(c.width, c.height) / Math.min(c.width, c.height); return r > 1.3 && r < 1.9; }

  /* ------------------------------------------------------------------ A4 composition (300 DPI) */
  var A4W = 2480, A4H = 3508, CW = 1011, CH = 638;       // CR80 85.6 x 54 mm at 300 DPI
  function a4() { var c = newCanvas(A4W, A4H), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, A4W, A4H); x.imageSmoothingQuality = 'high'; c.eff = 300; return c; }
  function contain(x, img, bx, by, bw, bh) {
    var k = Math.min(bw / img.width, bh / img.height), w = img.width * k, h = img.height * k;
    x.drawImage(img, bx + (bw - w) / 2, by + (bh - h) / 2, w, h);
  }
  function compose(layout, front, back) {
    var pages = [], x, p;
    if (layout === 'id') {
      p = a4(); x = p.getContext('2d');
      var gap = 90, n = back ? 2 : 1, total = n * CW + (n - 1) * gap, x0 = Math.round((A4W - total) / 2), y0 = 150;
      [front, back].forEach(function (im, i) {
        if (!im) return;
        var cx = x0 + i * (CW + gap);
        x.drawImage(im, cx, y0, CW, CH);
        x.strokeStyle = '#d4d8e0'; x.lineWidth = 2; x.strokeRect(cx, y0, CW, CH);
      });
      pages.push(p);
    } else if (layout === 'admit') {
      p = a4(); x = p.getContext('2d');
      var m = 90, hh = A4H / 2;
      contain(x, front, m, m, A4W - 2 * m, hh - 1.5 * m);
      if (back) contain(x, back, m, hh + m / 2, A4W - 2 * m, hh - 1.5 * m);
      pages.push(p);
    } else {
      [front, back].forEach(function (im) {
        if (!im) return;
        p = a4(); x = p.getContext('2d'); contain(x, im, 94, 94, A4W - 188, A4H - 188); pages.push(p);
      });
    }
    return pages;
  }

  /* ------------------------------------------------------------------ UI */
  var CSS = [
    'html.sw-lock,html.sw-lock body{overflow:hidden!important}',
    '#sw{position:fixed;inset:0;z-index:2000;background:#0f1117;color:#fff;display:none;flex-direction:column;font-family:inherit;overscroll-behavior:none;-webkit-tap-highlight-color:transparent}',
    '#sw.on{display:flex}',
    '#sw *{box-sizing:border-box}',
    '#sw .sw-h{flex:none;display:flex;align-items:center;gap:10px;min-height:52px;padding:calc(env(safe-area-inset-top,0px) + 6px) 16px 6px;border-bottom:1px solid #1f2330;font-weight:700;font-size:15px}',
    '#sw .sw-h b{flex:1;font-weight:700}',
    '#sw .sw-x{all:unset;cursor:pointer;width:36px;height:36px;display:grid;place-items:center;border-radius:10px;font-size:18px;color:#cbd2e0}',
    '#sw .sw-x:hover{background:#1c2030}',
    '#sw .sw-v{display:none;flex:1;min-height:0;flex-direction:column}',
    '#sw .sw-v.on{display:flex}',
    '#sw .sw-sc{flex:1;min-height:0;overflow:auto;padding:22px 16px calc(24px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center}',
    '#sw .sw-in{width:100%;max-width:520px;margin:auto 0}',
    '#sw h2{margin:0 0 8px;text-align:center;font-size:22px;font-weight:800;color:#fff}',
    '#sw .sw-p{margin:0 0 20px;text-align:center;color:#a5adbf;font-size:14.5px;line-height:1.5}',
    '#sw .sw-opt{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:14px;width:100%;padding:13px 14px;margin-bottom:10px;background:#171a24;border:1px solid #272c3b;border-radius:16px;cursor:pointer;transition:border-color .15s,background .15s,transform .15s}',
    '#sw .sw-opt:hover,#sw .sw-opt:focus-visible{border-color:#8b5cf6;background:#1b1f2d}',
    '#sw .sw-opt:active{transform:scale(.985)}',
    '#sw .sw-opt b{display:block;font-size:16px;font-weight:800;color:#fff}',
    '#sw .sw-opt small{display:block;margin-top:3px;color:#a5adbf;font-size:12.5px;line-height:1.4}',
    '#sw .sw-ic{flex:none;width:44px;height:52px}',
    '#sw .sw-ico{flex:none;font-size:30px;width:44px;text-align:center}',
    '#sw .sw-btn{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:12px 18px;border-radius:12px;background:#1c2030;color:#e6e9f2;font-weight:700;font-size:14.5px;border:1px solid #2a3044;text-align:center;transition:transform .15s,filter .15s}',
    '#sw .sw-btn:active{transform:scale(.97)}',
    '#sw .sw-btn.pri{background:linear-gradient(135deg,#6d4df5,#a855f7);border-color:transparent;color:#fff}',
    '#sw .sw-btn.ok{background:#22a35a;border-color:transparent;color:#fff}',
    '#sw .sw-btn.gold{background:transparent;border:1.5px solid #5a4a1c;color:#f5c542}',
    '#sw .sw-row{display:flex;justify-content:center;margin-top:8px}',
    '#sw .sw-ct{flex:none;text-align:center;padding:12px 16px 4px}',
    '#sw .sw-ct b{display:block;font-size:17px;font-weight:800}',
    '#sw .sw-ct span{display:block;margin-top:3px;color:#a5adbf;font-size:12.5px;line-height:1.4}',
    '#sw .sw-stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:8px;touch-action:none}',
    '#sw .sw-stage canvas.sw-c{display:block;touch-action:none;-webkit-user-select:none;user-select:none;border-radius:6px;background:#000}',
    '#sw .sw-lp{position:absolute;width:104px;height:104px;border-radius:50%;border:3px solid #8b5cf6;overflow:hidden;box-shadow:0 8px 24px #000a;pointer-events:none;display:none;background:#000;z-index:3}',
    '#sw .sw-lp canvas{width:100%;height:100%;display:block}',
    '#sw .sw-bar{flex:none;display:flex;gap:10px;padding:10px 14px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid #1f2330;background:#0f1117}',
    '#sw .sw-bar .sw-btn{flex:1;padding:14px 8px}',
    '#sw .sw-bar .sw-btn.pri{flex:1.3}',
    '#sw .sw-busy{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:#0f1117cc;font-weight:700;z-index:4;font-size:15px}',
    '#sw .sw-busy.on{display:flex}',
    '#sw .sw-pv{display:flex;gap:12px;justify-content:center;align-items:flex-start;margin:6px 0 14px;flex-wrap:wrap}',
    '#sw .sw-pv figure{margin:0;text-align:center;max-width:100%}',
    '#sw .sw-pv img{display:block;max-width:100%;max-height:44vh;border-radius:8px;box-shadow:0 10px 30px #0008;background:#fff}',
    '#sw .sw-pv.two img{max-width:min(44vw,260px)}',
    '#sw .sw-pv figcaption{margin-top:6px;color:#a5adbf;font-size:12px;font-weight:700}',
    '#sw .sw-stk{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:6px}',
    '#sw .sw-stk .sw-btn{min-width:230px}'
  ].join('\n');

  var ICONS = {
    id: '<svg class="sw-ic" viewBox="0 0 44 52"><rect x="1" y="1" width="42" height="50" rx="6" fill="#fff"/><rect x="6" y="6" width="14" height="9" rx="2" fill="#6d4df5"/><rect x="24" y="6" width="14" height="9" rx="2" fill="#a78bfa"/></svg>',
    cert: '<svg class="sw-ic" viewBox="0 0 44 52"><rect x="1" y="1" width="42" height="50" rx="6" fill="#fff"/><rect x="6" y="6" width="32" height="40" rx="3" fill="#6d4df5"/></svg>',
    admit: '<svg class="sw-ic" viewBox="0 0 44 52"><rect x="1" y="1" width="42" height="50" rx="6" fill="#fff"/><rect x="6" y="6" width="32" height="19" rx="3" fill="#6d4df5"/><rect x="6" y="27" width="32" height="19" rx="3" fill="#a78bfa"/></svg>',
    auto: '<svg class="sw-ic" viewBox="0 0 44 52"><rect x="1" y="1" width="42" height="50" rx="6" fill="#fff"/><rect x="6" y="6" width="32" height="40" rx="3" fill="none" stroke="#6d4df5" stroke-width="2" stroke-dasharray="4 3"/><text x="22" y="34" text-anchor="middle" font-size="20" font-weight="800" fill="#6d4df5" font-family="sans-serif">?</text></svg>'
  };

  var root = null, S = {}, els = {}, drag = -1, dragOff = null, geo = null, ready = false;

  function reset() { S = { layout: 'id', side: 'front', src: null, quad: null, sides: { front: null, back: null } }; }
  reset();

  function build() {
    if (root) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'sw'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.innerHTML =
      '<div class="sw-h"><b data-i="title"></b><button class="sw-x" type="button" data-a="close" aria-label="Close">✕</button></div>' +
      '<div class="sw-v" id="sw-type"><div class="sw-sc"><div class="sw-in">' +
        '<h2 data-i="type.q"></h2><p class="sw-p" data-i="type.s"></p>' +
        ['id', 'cert', 'admit', 'auto'].map(function (k) {
          return '<button class="sw-opt" type="button" data-type="' + k + '">' + ICONS[k] + '<span><b data-i="' + k + '.t"></b><small data-i="' + k + '.s"></small></span></button>';
        }).join('') +
      '</div></div></div>' +
      '<div class="sw-v" id="sw-src"><div class="sw-sc"><div class="sw-in">' +
        '<h2 id="sw-srcq" data-i="src.q"></h2><p class="sw-p" data-i="src.s"></p>' +
        '<button class="sw-opt" type="button" data-a="cam"><span class="sw-ico">📷</span><span><b data-i="cam.t"></b><small data-i="cam.s"></small></span></button>' +
        '<button class="sw-opt" type="button" data-a="file"><span class="sw-ico">📁</span><span><b data-i="file.t"></b><small data-i="file.s"></small></span></button>' +
        '<div class="sw-row"><button class="sw-btn" type="button" data-a="srcback" data-i="back"></button></div>' +
        '<input id="sw-fcam" type="file" accept="image/*" capture="environment" hidden>' +
        '<input id="sw-ffile" type="file" accept="image/*" hidden>' +
      '</div></div></div>' +
      '<div class="sw-v" id="sw-crop">' +
        '<div class="sw-ct"><b data-i="crop.t"></b><span data-i="crop.s"></span></div>' +
        '<div class="sw-stage" id="sw-stage"><canvas class="sw-c" id="sw-cv"></canvas><div class="sw-lp" id="sw-lp"><canvas id="sw-lpc" width="208" height="208"></canvas></div><div class="sw-busy" id="sw-busy"></div></div>' +
        '<div class="sw-bar"><button class="sw-btn" type="button" data-a="cancel" data-i="cancel"></button><button class="sw-btn" type="button" data-a="fullphoto" data-i="full"></button><button class="sw-btn pri" type="button" data-a="docrop" data-i="crop"></button></div>' +
      '</div>' +
      '<div class="sw-v" id="sw-ok"><div class="sw-sc"><div class="sw-in">' +
        '<h2 id="sw-okt"></h2><div class="sw-pv" id="sw-pv"></div><p class="sw-p" data-i="ok.hint"></p>' +
        '<div class="sw-stk"><div id="sw-rots" class="sw-stk" style="flex-direction:row;flex-wrap:wrap;justify-content:center"></div>' +
        '<button class="sw-btn ok" type="button" data-a="done" data-i="done"></button>' +
        '<button class="sw-btn gold" type="button" data-a="addback" id="sw-addback" data-i="addback"></button></div>' +
      '</div></div></div>';
    document.body.appendChild(root);
    ['stage', 'cv', 'lp', 'lpc', 'busy', 'okt', 'pv', 'rots', 'addback', 'fcam', 'ffile', 'srcq'].forEach(function (k) { els[k] = document.getElementById('sw-' + k); });

    root.addEventListener('click', onClick);
    els.fcam.onchange = els.ffile.onchange = function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onPhoto(f); };
    bindCanvas();
    window.addEventListener('resize', function () { if (root.classList.contains('on') && S.view === 'crop') { fit(); draw(); } });
    window.addEventListener('orientationchange', function () { setTimeout(function () { if (S.view === 'crop') { fit(); draw(); } }, 250); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('on')) close(); });
    new MutationObserver(applyLang).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    root.addEventListener('touchmove', function (e) { if (e.target.closest && e.target.closest('.sw-stage')) e.preventDefault(); }, { passive: false });
  }

  function applyLang() {
    if (!root) return;
    [].forEach.call(root.querySelectorAll('[data-i]'), function (n) { n.textContent = t(n.getAttribute('data-i')); });
    if (S.view === 'type' || S.view === 'src') setSrcTitle();
    if (S.view === 'ok') renderOk();
  }
  function setSrcTitle() { if (els.srcq) els.srcq.textContent = S.side === 'back' ? t('backFor') + ' — ' + t('src.q') : t('src.q'); }

  function show(v) {
    S.view = v;
    [].forEach.call(root.querySelectorAll('.sw-v'), function (n) { n.classList.toggle('on', n.id === 'sw-' + v); });
    if (v === 'src') setSrcTitle();
    var sc = root.querySelector('#sw-' + v + ' .sw-sc'); if (sc) sc.scrollTop = 0;
  }

  function open() {
    build(); reset(); applyLang();
    root.classList.add('on'); document.documentElement.classList.add('sw-lock');
    show('type');
    if (typeof window.cvReady === 'function') { try { window.cvReady().catch(function () {}); } catch (e) { /* ignore */ } }
  }
  function close() {
    if (!root) return;
    root.classList.remove('on'); document.documentElement.classList.remove('sw-lock');
    S.src = null; S.view = null;
  }

  function onClick(e) {
    var a = e.target.closest && e.target.closest('[data-a],[data-type]'); if (!a) return;
    if (a.dataset.type) { S.layout = a.dataset.type; S.side = 'front'; show('src'); return; }
    switch (a.dataset.a) {
      case 'close': close(); break;
      case 'srcback': if (S.side === 'back') { S.side = 'front'; showOk(); } else show('type'); break;
      case 'cam': els.fcam.click(); break;
      case 'file': els.ffile.click(); break;
      case 'cancel': S.src = null; show('src'); break;
      case 'fullphoto': if (S.src) { S.quad = fullQuad(S.src.width, S.src.height); draw(); } break;
      case 'docrop': doCrop(); break;
      case 'rotF': S.sides.front = rotateCW(S.sides.front); renderOk(); break;
      case 'rotB': S.sides.back = rotateCW(S.sides.back); renderOk(); break;
      case 'done': finish(); break;
      case 'addback': S.side = 'back'; show('src'); break;
    }
  }

  /* ---- photo loading ---- */
  async function readImage(file) {
    var bmp = null;
    try { if (window.createImageBitmap) bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = null; }
    var w, h, drawable;
    if (bmp) { w = bmp.width; h = bmp.height; drawable = bmp; }
    else {
      drawable = await new Promise(function (ok, no) {
        var u = URL.createObjectURL(file), im = new Image();
        im.onload = function () { URL.revokeObjectURL(u); ok(im); };
        im.onerror = function () { URL.revokeObjectURL(u); no(new Error('img')); };
        im.src = u;
      });
      w = drawable.naturalWidth; h = drawable.naturalHeight;
    }
    var k = Math.min(1, 3000 / Math.max(w, h)), c = newCanvas(Math.round(w * k), Math.round(h * k));
    c.getContext('2d').drawImage(drawable, 0, 0, c.width, c.height);
    if (bmp && bmp.close) bmp.close();
    return c;
  }
  async function onPhoto(file) {
    show('crop'); setBusy(t('detecting'));
    try {
      S.src = await readImage(file);
      fit(); S.quad = defaultQuad(S.src.width, S.src.height); draw();
      await frame();
      S.quad = await detectQuad(S.src);
      draw();
    } catch (e) {
      alert(t('readErr')); S.src = null; show('src');
    }
    setBusy('');
  }
  function setBusy(msg) { els.busy.textContent = msg || ''; els.busy.classList.toggle('on', !!msg); }

  /* ---- crop canvas ---- */
  var PAD = 20;
  function fit() {
    if (!S.src) return;
    var st = els.stage, aw = Math.max(80, st.clientWidth - 16 - PAD * 2), ah = Math.max(80, st.clientHeight - 16 - PAD * 2);
    var k = Math.min(aw / S.src.width, ah / S.src.height), dpr = Math.min(3, window.devicePixelRatio || 1);
    var iw = S.src.width * k, ih = S.src.height * k, cw = Math.round(iw + PAD * 2), ch = Math.round(ih + PAD * 2);
    els.cv.style.width = cw + 'px'; els.cv.style.height = ch + 'px';
    els.cv.width = Math.round(cw * dpr); els.cv.height = Math.round(ch * dpr);
    geo = { k: k, iw: iw, ih: ih, cw: cw, ch: ch, dpr: dpr };
  }
  function vpt(p) { return { x: PAD + p.x * geo.k, y: PAD + p.y * geo.k }; }
  function draw() {
    if (!S.src || !S.quad || !geo) return;
    var ctx = els.cv.getContext('2d'), g = geo;
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0); ctx.clearRect(0, 0, g.cw, g.ch);
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(S.src, PAD, PAD, g.iw, g.ih);
    var v = S.quad.map(vpt);
    ctx.save(); ctx.beginPath(); ctx.rect(PAD, PAD, g.iw, g.ih);
    ctx.moveTo(v[0].x, v[0].y); for (var i = 1; i < 4; i++) ctx.lineTo(v[i].x, v[i].y); ctx.closePath();
    ctx.fillStyle = 'rgba(10,12,22,.52)'; ctx.fill('evenodd'); ctx.restore();
    ctx.beginPath(); ctx.moveTo(v[0].x, v[0].y); for (i = 1; i < 4; i++) ctx.lineTo(v[i].x, v[i].y); ctx.closePath();
    ctx.lineWidth = 3; ctx.strokeStyle = '#8b5cf6'; ctx.lineJoin = 'round'; ctx.stroke();
    for (i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(v[i].x, v[i].y, 13, 0, 6.2832);
      ctx.fillStyle = drag === i ? 'rgba(139,92,246,.95)' : 'rgba(76,46,170,.55)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  }
  function pointer(e) { var r = els.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function nearest(p) {
    var best = -1, bd = 1e9;
    S.quad.forEach(function (q, i) { var v = vpt(q), d = Math.hypot(v.x - p.x, v.y - p.y); if (d < bd) { bd = d; best = i; } });
    return bd <= 64 ? best : -1;
  }
  function moveCorner(e) {
    var p = pointer(e), nx = (p.x + dragOff.x - PAD) / geo.k, ny = (p.y + dragOff.y - PAD) / geo.k;
    S.quad[drag] = { x: Math.max(0, Math.min(S.src.width, nx)), y: Math.max(0, Math.min(S.src.height, ny)) };
    draw(); loupe();
  }
  function loupe() {
    var q = S.quad[drag], v = vpt(q), lp = els.lp, sr = els.stage.getBoundingClientRect(), cr = els.cv.getBoundingClientRect();
    var x = cr.left - sr.left + v.x, y = cr.top - sr.top + v.y, top = y - 150; if (top < 4) top = y + 56;
    lp.style.left = Math.max(4, Math.min(sr.width - 108, x - 52)) + 'px'; lp.style.top = top + 'px'; lp.style.display = 'block';
    var c = els.lpc, ctx = c.getContext('2d'), side = 104 / (geo.k * 2.6) * 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 208, 208);
    ctx.drawImage(S.src, q.x - side / 2, q.y - side / 2, side, side, 0, 0, 208, 208);
    ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(104, 104, 14, 0, 6.2832); ctx.moveTo(104, 84); ctx.lineTo(104, 124); ctx.moveTo(84, 104); ctx.lineTo(124, 104); ctx.stroke();
  }
  function bindCanvas() {
    var cv = els.cv;
    cv.addEventListener('pointerdown', function (e) {
      if (!S.quad) return;
      var p = pointer(e), i = nearest(p); if (i < 0) return;
      drag = i; var v = vpt(S.quad[i]); dragOff = { x: v.x - p.x, y: v.y - p.y };
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      moveCorner(e); e.preventDefault();
    });
    cv.addEventListener('pointermove', function (e) { if (drag < 0) return; moveCorner(e); e.preventDefault(); });
    function end() { if (drag < 0) return; drag = -1; els.lp.style.display = 'none'; draw(); }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('lostpointercapture', end);
    cv.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    cv.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  }

  /* ---- crop -> warp -> enhance ---- */
  async function doCrop() {
    if (!S.src || !S.quad) return;
    setBusy(t('processing')); await frame();
    try {
      var q = S.quad, W = Math.round(Math.max(dist(q[0], q[1]), dist(q[3], q[2]))), H = Math.round(Math.max(dist(q[0], q[3]), dist(q[1], q[2])));
      if (W < 20 || H < 20) throw new Error('small');
      var k = Math.min(1, 2600 / Math.max(W, H)); W = Math.max(20, Math.round(W * k)); H = Math.max(20, Math.round(H * k));
      var out = warp(S.src, q, W, H);
      var idMode = S.layout === 'id' || (S.layout === 'auto' && isIdLike(out));
      if (idMode && out.height > out.width) out = rotateCW(out);
      out = idMode ? enhanceId(out) : enhanceDoc(out);
      S.sides[S.side] = out; S.src = null;
      showOk();
    } catch (e) { alert(t('readErr')); }
    setBusy('');
  }

  /* ---- confirmation ---- */
  function thumb(c) { var k = Math.min(1, 900 / Math.max(c.width, c.height)), s = newCanvas(Math.round(c.width * k), Math.round(c.height * k)); s.getContext('2d').drawImage(c, 0, 0, s.width, s.height); return s.toDataURL('image/jpeg', 0.85); }
  function showOk() { show('ok'); renderOk(); }
  function renderOk() {
    var f = S.sides.front, b = S.sides.back;
    if (!f) return;
    els.okt.textContent = b ? t('ok.both') : (S.side === 'back' ? t('ok.back') : t('ok.front'));
    els.pv.className = 'sw-pv' + (b ? ' two' : '');
    els.pv.innerHTML = '';
    [[f, 'side_front'], [b, 'side_back']].forEach(function (p) {
      if (!p[0]) return;
      var fig = document.createElement('figure'), im = document.createElement('img'), cap = document.createElement('figcaption');
      im.alt = ''; im.src = thumb(p[0]); cap.textContent = t(p[1]); fig.appendChild(im); if (b) fig.appendChild(cap); els.pv.appendChild(fig);
    });
    els.rots.innerHTML = '';
    function rb(a, label) { var x = document.createElement('button'); x.type = 'button'; x.className = 'sw-btn'; x.dataset.a = a; x.textContent = label; els.rots.appendChild(x); }
    if (b) { rb('rotF', t('rotF')); rb('rotB', t('rotB')); } else rb('rotF', t('rotate'));
    els.addback.style.display = b ? 'none' : '';
  }

  /* ---- finish: compose A4 and hand over ---- */
  function finish() {
    var f = S.sides.front, b = S.sides.back; if (!f) return;
    var layout = S.layout;
    if (layout === 'auto') layout = isIdLike(f) ? 'id' : 'cert';
    var pages = compose(layout, f, b);
    var label = t(layout === 'id' ? 'lblid' : layout === 'admit' ? 'lbladmit' : 'lblcert');
    var res = { pages: pages, layout: layout, label: label, hasBack: !!b };
    close(); reset();
    if (typeof SmartScan.onDone === 'function') SmartScan.onDone(res);
  }

  var SmartScan = window.SmartScan = { open: open, close: close, onDone: null, _t: { solveH: solveH, applyH: applyH, orderQuad: orderQuad, edgeQuad: edgeQuad, warp: warp, enhanceDoc: enhanceDoc, enhanceId: enhanceId, compose: compose } };
})();
