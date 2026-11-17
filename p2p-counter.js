/* =====================================================================================================================
   p2p-counter.js — counter.html side of the direct WebRTC file transfer (needs /p2p.js and PeerJS).

   * Owns the fixed peer id  P2P.COUNTER_ID  and keeps it alive: auto-reconnect with back-off, wake-from-sleep / network-back checks.
   * Every customer connection has its OWN transfer table keyed by transferId, so many customers can send at the same moment
     without their chunks ever mixing. A file is only accepted when chunk count + byte count + file signature check out.
   * Finished orders are stored locally (memory + IndexedDB so a reload loses nothing) and handed to counter.html through
       P2PCounter.orders()            -> order objects shaped exactly like /api/admin/orders rows (+ p2p:true)
       P2PCounter.handle(action,id)   -> Response-like answers for file/start/approve/cash-approve/done/reject/reprint
       P2PCounter.blob(fileId)        -> the reassembled File
   ===================================================================================================================== */
(function () {
  if (window.P2PCounter) return;
  var ID = P2P.COUNTER_ID, CHUNK = P2P.CHUNK;
  var ALLOWED = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
  var MAX_FILES = 10, MAX_FILE = 25 * 1024 * 1024, MAX_ORDER = 100 * 1024 * 1024, MAX_CONNS = 25, MAX_ACTIVE_BYTES = 400 * 1024 * 1024;
  var IDLE_MS = 60000, KEEP_MS = 24 * 3600 * 1000;

  var api = { onChange: null };
  var store = new Map();                         // orderId -> { id, order, blobs:[File] }
  var conns = new Set(), activeBytes = 0;

  /* ---------------------------------------------------------------- status badge */
  var status = 'connecting';
  var LABEL = { online: '⚡ P2P Receiver: Online', connecting: '⏳ P2P Receiver: Connecting…', reconnecting: '🔄 P2P Receiver: Reconnecting…',
    offline: '⛔ P2P Receiver: Offline', busy: '⚠️ P2P Receiver: ID in use (another counter tab?)' };
  var COLOR = { online: ['#dcfce7', '#166534'], connecting: ['#e0e7ff', '#3730a3'], reconnecting: ['#fef3c7', '#92400e'], offline: ['#fee2e2', '#b91c1c'], busy: ['#fee2e2', '#b91c1c'] };
  function paint() {
    var el = document.getElementById('p2pBadge'); if (!el) return;
    var s = (!navigator.onLine && status !== 'online') ? 'offline' : status, c = COLOR[s] || COLOR.offline;
    el.textContent = LABEL[s] || LABEL.offline; el.style.background = c[0]; el.style.color = c[1]; el.dataset.state = s;
    el.title = 'Direct WebRTC file transfer · peer id ' + ID;
  }
  function setStatus(s) { status = s; paint(); }
  api.status = function () { return status; };

  /* ---------------------------------------------------------------- peer lifecycle + automatic reconnection */
  var peer = null, backoff = 1000, timer = 0, idTaken = 0;
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(start, ms || backoff); backoff = Math.min(backoff * 2, 30000); }
  function kill(p) { try { p && p.destroy(); } catch (e) {} if (peer === p) peer = null; }

  function start() {
    clearTimeout(timer);
    if (peer && !peer.destroyed) { if (peer.disconnected) { setStatus('reconnecting'); try { peer.reconnect(); } catch (e) { kill(peer); schedule(); } } return; }
    setStatus(status === 'online' ? 'reconnecting' : 'connecting');
    P2P.loadPeer().then(function () {
      var p = new window.Peer(ID, { debug: 0, config: { iceServers: P2P.ICE } }); peer = p;
      p.on('open', function () { if (peer !== p) return; backoff = 1000; idTaken = 0; setStatus('online'); });
      p.on('connection', onConn);
      p.on('disconnected', function () {                      // lost the signalling server: same id can be re-claimed
        if (peer !== p) return; setStatus('reconnecting');
        setTimeout(function () { if (peer === p && p.disconnected && !p.destroyed) { try { p.reconnect(); } catch (e) { kill(p); schedule(); } } }, 800);
      });
      p.on('close', function () { if (peer === p) { peer = null; setStatus('reconnecting'); schedule(); } });
      p.on('error', function (e) {
        var t = e && e.type;
        if (t === 'unavailable-id') {                         // old session still registered, or a second counter tab
          kill(p); idTaken++; setStatus(idTaken > 5 ? 'busy' : 'reconnecting'); schedule(idTaken > 5 ? 10000 : 3000);
        } else if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed' || t === 'disconnected') {
          kill(p); setStatus(navigator.onLine ? 'reconnecting' : 'offline'); schedule();
        }                                                     // peer-unavailable / webrtc errors belong to a customer's connection only
      });
    }).catch(function () { setStatus('offline'); schedule(); });
  }
  function wake() {                                           // tab woke up / network came back
    if (!peer || peer.destroyed) { backoff = 1000; start(); }
    else if (peer.disconnected) { setStatus('reconnecting'); try { peer.reconnect(); } catch (e) { kill(peer); start(); } }
    else paint();
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
  window.addEventListener('online', function () { backoff = 1000; wake(); });
  window.addEventListener('offline', paint);
  window.addEventListener('pageshow', wake);
  setInterval(wake, 10000);                                   // heartbeat: also covers sleeping laptops / dead sockets

  /* ---------------------------------------------------------------- local order store (IndexedDB) */
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('therajesh_p2p_counter', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('orders', { keyPath: 'id' }); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function persist(rec) { idb().then(function (db) { var tx = db.transaction('orders', 'readwrite'); tx.objectStore('orders').put(rec); tx.oncomplete = function () { db.close(); }; }).catch(function () {}); }
  function unpersist(id) { idb().then(function (db) { var tx = db.transaction('orders', 'readwrite'); tx.objectStore('orders').delete(id); tx.oncomplete = function () { db.close(); }; }).catch(function () {}); }
  function restore() {
    idb().then(function (db) {
      var q = db.transaction('orders', 'readonly').objectStore('orders').getAll();
      q.onsuccess = function () {
        (q.result || []).forEach(function (rec) {
          if (!rec || !rec.order || Date.now() - rec.order.created_at > KEEP_MS) { rec && unpersist(rec.id); return; }
          if (!store.has(rec.id)) store.set(rec.id, rec);
        });
        db.close(); notify();
      };
    }).catch(function () {});
  }
  function notify() { try { api.onChange && api.onChange(); } catch (e) {} }

  /* ---------------------------------------------------------------- authoritative amount (recomputed here, never trusted from the customer) */
  var cfgP = null, cfgAt = 0;
  function getCfg() {
    if (cfgP && Date.now() - cfgAt < 300000) return cfgP;
    cfgAt = Date.now();
    cfgP = fetch('/api/config', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return cfgP;
  }

  /* ---------------------------------------------------------------- receiving */
  var clean = function (s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); };
  var safeName = function (s) { return clean(s, 120).replace(/[\\/:*?"<>|]/g, '_') || 'file'; };
  var extOf = function (n) { return (String(n).split('.').pop() || '').toLowerCase(); };
  var asU8 = function (d) {
    if (d instanceof ArrayBuffer) return new Uint8Array(d);
    if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
    return null;
  };
  function sniffOk(ext, u8) {                                 // cheap signature check for the common types
    if (!u8 || !u8.length) return false;
    if (ext === 'pdf') { var s = String.fromCharCode.apply(null, u8.subarray(0, Math.min(1024, u8.length))); return s.indexOf('%PDF') >= 0; }
    if (ext === 'jpg' || ext === 'jpeg') return u8[0] === 0xFF && u8[1] === 0xD8;
    if (ext === 'png') return u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47;
    return true;
  }

  function onConn(conn) {
    if (conns.size >= MAX_CONNS) { try { conn.on('open', function () { conn.send({ t: 'nack', error: 'Counter is busy, please try again' }); conn.close(); }); } catch (e) {} return; }
    conns.add(conn);
    var T = new Map();                                        // transferId -> transfer  (private to THIS customer connection)
    var G = new Map();                                        // orderId    -> { fileCount, done:{idx:File}, meta, bytes }

    function drop(tid) { var t = T.get(tid); if (t) { activeBytes -= t.size; T.delete(tid); } }
    function refuse(tid, err) { try { conn.send({ t: 'nack', transferId: tid, error: err }); } catch (e) {} drop(tid); }
    function cleanup() { T.forEach(function (t, k) { drop(k); }); G.clear(); conns.delete(conn); clearInterval(sweep); }
    var sweep = setInterval(function () { var now = Date.now(); T.forEach(function (t, k) { if (now - t.last > IDLE_MS) refuse(k, 'Transfer timed out'); }); }, 15000);

    conn.on('data', function (m) {
      try { onMsg(m); } catch (e) { try { console.warn('[P2P] bad message', e); } catch (x) {} }
    });
    conn.on('close', cleanup);
    conn.on('error', cleanup);

    function onMsg(m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'meta') return onMeta(m);
      if (m.t === 'chunk') return onChunk(m);
      if (m.t === 'end') return onEnd(m);
    }

    function onMeta(m) {
      var tid = clean(m.transferId, 40), oid = clean(m.orderId, 24);
      if (!/^P2P-[A-Z0-9]{4,12}$/.test(oid) || tid.indexOf(oid + '-') !== 0) return refuse(tid, 'Bad transfer id');
      if (store.has(oid)) { var o = store.get(oid).order; return conn.send({ t: 'order', orderId: oid, amount: o.amount, status: o.status }); }   // duplicate -> just re-ACK
      var name = safeName(m.fileName), ext = extOf(name), size = Number(m.fileSize), tc = Number(m.totalChunks), cnt = Number(m.fileCount), idx = Number(m.idx);
      if (!ALLOWED[ext]) return refuse(tid, 'File type not allowed: ' + name);
      if (!(size > 0) || size > MAX_FILE) return refuse(tid, name + ' is larger than 25 MB');
      if (tc !== Math.max(1, Math.ceil(size / CHUNK))) return refuse(tid, 'Bad chunk count');
      if (!(cnt >= 1 && cnt <= MAX_FILES) || !(idx >= 0 && idx < cnt)) return refuse(tid, 'Bad file count');
      if (T.has(tid) || T.size >= 12) return refuse(tid, 'Too many transfers');
      if (activeBytes + size > MAX_ACTIVE_BYTES) return refuse(tid, 'Counter is busy, please try again');
      var g = G.get(oid); if (!g) G.set(oid, g = { fileCount: cnt, done: {}, meta: m, bytes: 0 });
      g.bytes += size; if (g.bytes > MAX_ORDER) return refuse(tid, 'Total upload is larger than 100 MB');
      activeBytes += size;
      T.set(tid, { oid: oid, idx: idx, name: name, ext: ext, size: size, total: tc, chunks: new Array(tc), got: 0, bytes: 0, last: Date.now() });
    }

    function onChunk(m) {
      var t = T.get(m.transferId); if (!t) return;
      var u8 = asU8(m.data), i = Number(m.i);
      if (!u8 || !(i >= 0 && i < t.total)) return refuse(m.transferId, 'Bad chunk');
      if (!t.chunks[i]) { t.chunks[i] = u8; t.got++; t.bytes += u8.length; if (t.bytes > t.size) return refuse(m.transferId, 'File larger than announced'); }
      t.last = Date.now();
    }

    function onEnd(m) {
      var tid = m.transferId, t = T.get(tid); if (!t) return;
      if (t.got !== t.total || t.bytes !== t.size) return refuse(tid, 'File arrived incomplete');
      if (!sniffOk(t.ext, t.chunks[0])) return refuse(tid, 'File content does not match its type');
      var file = new File(t.chunks, t.name, { type: ALLOWED[t.ext] || 'application/octet-stream' });       // reassembled in chunk order
      var g = G.get(t.oid); drop(tid);
      if (!g) return;
      g.done[t.idx] = file;
      try { conn.send({ t: 'ack', transferId: tid }); } catch (e) {}
      if (Object.keys(g.done).length === g.fileCount) { G.delete(t.oid); finalize(conn, t.oid, g); }
    }
  }

  async function finalize(conn, oid, g) {
    if (store.has(oid)) return;
    var m = g.meta, po = (m.printOptions && typeof m.printOptions === 'object') ? m.printOptions : {};
    var kind = po.kind === 'passport' ? 'passport' : 'doc';
    var paper = ['A4', 'A3', '4x6'].indexOf(po.paper) >= 0 ? po.paper : 'A4';
    var color = (po.color || paper === '4x6' || kind === 'passport') ? 1 : 0;
    var copies = Math.min(Math.max(parseInt(po.copies) || 1, 1), kind === 'passport' ? 20 : 100);
    var orient = (Array.isArray(po.orient) ? po.orient : []).map(function (x) { return x === 'landscape' ? 'landscape' : 'portrait'; });
    var pages = Array.isArray(po.pages) ? po.pages : [];
    var blobs = [], files = [];
    for (var i = 0; i < g.fileCount; i++) {
      var f = g.done[i]; blobs.push(f);
      files.push({ id: oid + '-' + i, name: f.name, pages: Math.min(Math.max(parseInt(pages[i]) || 1, 1), 2000), size: f.size });
    }
    var cfg = await getCfg();
    var amount = cfg ? P2P.estimate({ kind: kind, paper: paper, color: color, copies: copies, pages: files.map(function (x) { return x.pages; }) }, cfg)
                     : (Number(po.estAmount) > 0 && Number(po.estAmount) < 100000 ? Number(po.estAmount) : 0);
    var order = {
      id: oid, token: '', name: clean(m.customerName || po.name, 60), phone: clean(po.phone, 15).replace(/[^\d+]/g, ''),
      color: color, copies: copies, amount: amount, status: 'cash_wait', pay_status: '', created_at: Date.now(), paper: paper,
      opts: JSON.stringify({ kind: kind, orient: orient, info: clean(po.info, 160) }), source: 'web', p2p: true, note: '', wa_number: '', files: files
    };
    var rec = { id: oid, order: order, blobs: blobs };
    store.set(oid, rec); persist(rec);
    try { conn.send({ t: 'order', orderId: oid, amount: amount, status: order.status }); } catch (e) {}   // ACK -> sender shows "Delivered"
    notify();
    try { window.ShopVoice && ShopVoice.paymentSuccess({ id: oid }); } catch (e) {}                        // existing Bengali voice alert
  }

  /* ---------------------------------------------------------------- what counter.html uses */
  api.orders = function () {
    var now = Date.now(), out = [];
    store.forEach(function (rec, id) { if (now - rec.order.created_at > KEEP_MS) { store.delete(id); unpersist(id); } else out.push(rec.order); });
    return out;
  };
  api.count = function () { return store.size; };
  function recOf(id) { id = String(id); return store.get(id) || store.get(id.replace(/-\d+$/, '')); }
  api.blob = function (fileId) {
    var rec = recOf(fileId); if (!rec) return null;
    var idx = parseInt(String(fileId).split('-').pop(), 10);
    return rec.blobs[idx] || null;
  };
  api.remove = function (id) { var rec = store.get(id); if (!rec) return; store.delete(id); unpersist(id); notify(); };
  api.clear = function () { Array.from(store.keys()).forEach(api.remove); };
  var json = function (o, st) { return new Response(JSON.stringify(o), { status: st || 200, headers: { 'content-type': 'application/json' } }); };
  /* answers the same calls counter.html makes to /api/admin/... for server orders, so Preview / Print / Download / Delete behave the same */
  api.handle = function (action, id) {
    if (action === 'file') {
      var b = api.blob(id);
      return b ? new Response(b, { status: 200, headers: { 'content-type': b.type || 'application/octet-stream' } }) : json({ error: 'File unavailable' }, 404);
    }
    var rec = recOf(id); if (!rec) return json({ error: 'Order not found' }, 404);
    var o = rec.order;
    if (action === 'reject') { api.remove(o.id); return json({ ok: true }); }
    if (action === 'cash-approve') { o.pay_status = 'cash_received'; o.status = 'printing'; }
    else if (action === 'approve' || action === 'start') { if (o.status !== 'printed') o.status = 'printing'; }
    else if (action === 'done') { o.status = 'printed'; }
    else if (action === 'reprint') { o.status = 'printing'; }
    persist(rec); notify();
    return json({ ok: true });
  };
  api.start = start; api.paint = paint;

  restore();
  start();
  document.addEventListener('DOMContentLoaded', paint);
  window.P2PCounter = api;
})();
