// Cloudflare Pages "advanced mode" worker (_worker.js) — works with drag-and-drop upload.
// Bindings to add in the dashboard:  DB (D1 database)  and  FILES (KV namespace)
// Secrets/variables:  AUTO_APPROVE ("1" = print without counter approval), RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (secret), GOOGLE_CLIENT_ID, ADMIN_EMAILS (comma list of allowed Google accounts), SESSION_SECRET (any long random text; falls back to AGENT_KEY), AGENT_KEY, YOUPI_WEBHOOK_SECRET, optional SHOP_NAME, YOUPI_KEY, YOUPI_BASE, YOUPI_AUTO_APPROVE

// ---- DEFAULT PRICES (rupees) — the counter's 💰 Prices button overrides these (saved in the database) ----
const RATE = { bw: 5, color: 10 };          // A4 per page
const A3_MULTIPLIER = 2;                    // A3 page = A4 price x 2
const PHOTO_4X6 = 20;                       // one 4x6 photo print
const PASSPORT_SHEET = { '4x6': 30, A4: 50 }; // one sheet of passport photos
const PAPERS = ['A4', 'A3', '4x6'];
const MAX_FILES = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // KV value limit is 25 MB
const ALLOWED = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
const FILE_TTL = 2 * 60 * 60; // safety: KV auto-deletes files after 2 hours even if never printed

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });


// ---------- price control ----------
const PRICE_KEYS = { bw: 'B&W per page', color: 'Color per page', a3: 'A3 multiplier', photo4x6: '4x6 photo print', passport4x6: 'Passport sheet 4x6', passportA4: 'Passport sheet A4' };
async function getPrices(env) {
  const d = { bw: RATE.bw, color: RATE.color, a3: A3_MULTIPLIER, photo4x6: PHOTO_4X6, passport4x6: PASSPORT_SHEET['4x6'], passportA4: PASSPORT_SHEET.A4 };
  try {
    await ensureSchema(env);
    const row = await env.DB.prepare("SELECT v FROM settings WHERE k='prices'").first();
    if (row && row.v) { const s = JSON.parse(row.v); for (const k of Object.keys(d)) if (Number.isFinite(Number(s[k])) && Number(s[k]) >= 0) d[k] = Number(s[k]); }
  } catch {}
  return d;
}
async function savePrices(request, env) {
  await ensureSchema(env);
  const b = await request.json().catch(() => ({}));
  const cur = await getPrices(env), out = {};
  for (const k of Object.keys(PRICE_KEYS)) {
    const n = Number(b[k] !== undefined ? b[k] : cur[k]);
    if (!Number.isFinite(n) || n < 0 || n > 10000) return json({ error: 'Invalid price for ' + PRICE_KEYS[k] }, 400);
    out[k] = Math.round(n * 100) / 100;
  }
  if (out.a3 < 1) return json({ error: 'A3 multiplier must be 1 or more' }, 400);
  await env.DB.prepare("INSERT INTO settings (k,v) VALUES ('prices',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(out)).run();
  return json({ ok: true, prices: out });
}

const ext = (name) => (name.split('.').pop() || '').toLowerCase();
const safeName = (name) => name.replace(/[^\w.\-]+/g, '_').slice(0, 80);

function newId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const path = url.pathname.slice(5).replace(/\/+$/, '');
    const method = request.method;
    let m;
    try {
      if (!env.DB || !env.FILES) {
        return json({ error: 'Setup incomplete: add bindings DB (D1) and FILES (KV), then redeploy.' }, 500);
      }
      if (path === 'config' && method === 'GET') {
        const p = await getPrices(env);
        const youpiKey = clean(env.YOUPI_KEY) || YOUPI_PUBLIC_KEY;
        const youpi = (youpiKey && youpiKey !== YOUPI_PUBLIC_KEY) ? { key: youpiKey, base: (clean(env.YOUPI_BASE) || 'https://pay.therajesh.shop').replace(/\/+$/, '') } : null;
        return json({ shop: env.SHOP_NAME || 'Digital Seva Kendra', rate: { bw: p.bw, color: p.color }, a3: p.a3, photo4x6: p.photo4x6, passport: { '4x6': p.passport4x6, A4: p.passportA4 }, youpi, razorpay: rzpPublic(env), razorpayMissing: rzpMissing(env) });
      }
      if (path === 'youpi/webhook' && method === 'POST') return youpiWebhook(request, env);
      if (path === 'create-order' && method === 'POST') return rzpCreateOrder(request, env);
      if (path === 'verify-payment' && method === 'POST') return rzpVerify(request, env);
      if (path === 'orders' && method === 'POST') return createOrder(request, env);
      m = path.match(/^orders\/([A-Z0-9]+)$/);
      if (m && method === 'GET') return orderStatus(env, m[1]);

      if (path === 'admin-config' && method === 'GET') return json({ googleClientId: clean(env.GOOGLE_CLIENT_ID) || null });
      if (path === 'admin-login' && method === 'POST') return adminLogin(request, env);
      if (path === 'visit' && method === 'POST') return recordVisit(request, env);

      if (path.startsWith('admin/')) {
        const who = await roleOf(request, env);
        if (!who) return json({ error: 'Please sign in with Google' }, 401);
        if (path === 'admin/orders' && method === 'GET') return adminList(env);
        if (path === 'admin/statement' && method === 'GET') return adminStatement(request, env);
        if (path === 'admin/ping') return json({ ok: true, role: who.role, email: who.email });
        if (path === 'admin/visitors' && method === 'GET') return adminVisitors(env);
        if (path === 'admin/prices' && method === 'GET') return json({ prices: await getPrices(env), labels: PRICE_KEYS });
        if (path === 'admin/prices' && method === 'POST') return savePrices(request, env);
        if (path === 'admin/clear' && method === 'POST') return adminClear(env);
        m = path.match(/^admin\/(start|done)\/([A-Z0-9]+)$/);
        if (m && method === 'POST') return adminMark(request, env, m[2], m[1]);
        m = path.match(/^admin\/(approve|reject)\/([A-Z0-9]+)$/);
        if (m && method === 'POST') return adminDecide(env, m[2], m[1]);
        m = path.match(/^admin\/file\/(\d+)$/);
        if (m && method === 'GET') return serveFile(env, m[1]);
      }

      if (path.startsWith('agent/')) {
        if (!sameSecret(request.headers.get('x-agent-key'), env.AGENT_KEY)) return json({ error: 'Bad agent key' }, 401);
        if (path === 'agent/jobs' && method === 'GET') return agentJobs(env);
        m = path.match(/^agent\/(claim|printed|done|fail)\/([A-Z0-9]+)$/);
        if (m && method === 'POST') return agentUpdate(request, env, m[2], m[1]);
        m = path.match(/^agent\/file\/(\d+)$/);
        if (m && method === 'GET') return serveFile(env, m[1]);
      }

      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: 'Server error', detail: String((e && e.message) || e) }, 500);
    }
  },
};

// Shared helpers.
const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
function sameSecret(a, b) {
  a = clean(a); b = clean(b);
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const b64u = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
const adminEmails = (env) => clean(env.ADMIN_EMAILS).toLowerCase().split(/[\s,;]+/).filter(Boolean);
const sessionSecret = (env) => clean(env.SESSION_SECRET) || clean(env.AGENT_KEY);

// Counter access = a signed session issued after a verified Google sign-in (only for emails in ADMIN_EMAILS),
// or the shop's Print Agent key. There is no shared password any more.
async function roleOf(request, env) {
  const key = request.headers.get('x-agent-key');
  if (key && sameSecret(key, env.AGENT_KEY)) return { role: 'agent', email: 'print-agent' };
  const tok = (request.headers.get('x-admin-session') || '').trim();
  const secret = sessionSecret(env);
  const i = tok.indexOf('.');
  if (i < 1 || !secret || tok.length > 1500) return null;
  const payload = tok.slice(0, i);
  if (!sameSecret(tok.slice(i + 1), await hmacHex(secret, new TextEncoder().encode(payload)))) return null;
  let p; try { p = JSON.parse(unb64u(payload)); } catch { return null; }
  if (!p || !p.e || !(p.x > Date.now()) || !adminEmails(env).includes(String(p.e).toLowerCase())) return null;
  return { role: 'admin', email: p.e };
}
async function verifyGoogle(idToken, env) {
  if (!idToken) return null;
  let info;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
    if (!r.ok) return null;
    info = await r.json();
  } catch { return null; }
  if (info.aud !== clean(env.GOOGLE_CLIENT_ID)) return null;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(info.iss)) return null;
  if (String(info.email_verified) !== 'true' || !(Number(info.exp) * 1000 > Date.now())) return null;
  return String(info.email || '').toLowerCase() || null;
}
async function adminLogin(request, env) {
  if (!clean(env.GOOGLE_CLIENT_ID) || !adminEmails(env).length || !sessionSecret(env)) {
    return json({ error: 'Google login is not set up yet. In Cloudflare add GOOGLE_CLIENT_ID, ADMIN_EMAILS and SESSION_SECRET, then redeploy.' }, 500);
  }
  const b = await request.json().catch(() => ({}));
  const email = await verifyGoogle(String(b.credential || '').slice(0, 4096), env);
  if (!email) return json({ error: 'Google sign-in could not be verified. Please try again.' }, 401);
  if (!adminEmails(env).includes(email)) return json({ error: `This Google account (${email}) is not allowed here.` }, 403);
  const payload = b64u(JSON.stringify({ e: email, x: Date.now() + 14 * 86400000 }));
  return json({ session: payload + '.' + await hmacHex(sessionSecret(env), new TextEncoder().encode(payload)), email });
}

// ---------- visitor counter (IP + approximate location from Cloudflare) ----------
async function recordVisit(request, env) {
  const ua = (request.headers.get('user-agent') || '').slice(0, 160);
  if (/bot|crawl|spider|slurp|preview|monitor|headless|lighthouse/i.test(ua)) return json({ ok: true });
  const b = await request.json().catch(() => ({}));
  let path = String(b.path || '/').slice(0, 80);
  if (!/^\/[\w\-./]*$/.test(path)) path = '/';
  const ip = (request.headers.get('cf-connecting-ip') || '').slice(0, 64);
  if (!ip) return json({ ok: true });
  await ensureSchema(env);
  const cf = request.cf || {}, now = Date.now();
  const dup = await env.DB.prepare('SELECT 1 AS x FROM visits WHERE ip=? AND path=? AND ts>? LIMIT 1').bind(ip, path, now - 30 * 60000).first();
  if (!dup) {
    await env.DB.prepare('INSERT INTO visits (ts, ip, country, region, city, path, ua) VALUES (?,?,?,?,?,?,?)')
      .bind(now, ip, String(cf.country || ''), String(cf.region || ''), String(cf.city || ''), path, ua).run();
    if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM visits WHERE ts<?').bind(now - 90 * 86400000).run();   // logs are kept 90 days
  }
  return json({ ok: true });
}
async function adminVisitors(env) {
  await ensureSchema(env);
  const IST = 19800000, now = Date.now();
  const dayStart = Math.floor((now + IST) / 86400000) * 86400000 - IST;
  const all = async (sql, ...a) => ((await env.DB.prepare(sql).bind(...a).all()).results) || [];
  const one = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).first()) || {};
  const total = await one('SELECT COUNT(*) AS v, COUNT(DISTINCT ip) AS u FROM visits');
  const today = await one('SELECT COUNT(*) AS v, COUNT(DISTINCT ip) AS u FROM visits WHERE ts>=?', dayStart);
  const week = await one('SELECT COUNT(*) AS v, COUNT(DISTINCT ip) AS u FROM visits WHERE ts>=?', dayStart - 6 * 86400000);
  const online = await one('SELECT COUNT(DISTINCT ip) AS u FROM visits WHERE ts>=?', now - 15 * 60000);
  const days = (await all('SELECT CAST((ts+?)/86400000 AS INTEGER) AS d, COUNT(*) AS v, COUNT(DISTINCT ip) AS u FROM visits WHERE ts>=? GROUP BY d ORDER BY d', IST, dayStart - 13 * 86400000))
    .map((r) => ({ date: new Date(r.d * 86400000).toISOString().slice(0, 10), v: r.v, u: r.u }));
  const places = await all('SELECT country, region, city, COUNT(*) AS v, COUNT(DISTINCT ip) AS u FROM visits WHERE ts>=? GROUP BY country, region, city ORDER BY v DESC LIMIT 10', now - 30 * 86400000);
  const pages = await all('SELECT path, COUNT(*) AS v FROM visits WHERE ts>=? GROUP BY path ORDER BY v DESC LIMIT 8', now - 30 * 86400000);
  const recent = await all('SELECT ts, ip, country, region, city, path FROM visits ORDER BY ts DESC LIMIT 60');
  return json({ total, today, week, online, days, places, pages, recent });
}

// Adds the new columns automatically the first time (no manual SQL needed).
let schemaChecked = false;
async function ensureSchema(env) {
  if (schemaChecked) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT)').run();
  // permanent sales ledger for the counter's Statement (no names or phone numbers are kept here)
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ledger (order_id TEXT PRIMARY KEY, ts INTEGER, amount REAL, copies INTEGER, pages INTEGER, paper TEXT, color INTEGER, kind TEXT)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, ip TEXT, country TEXT, region TEXT, city TEXT, path TEXT, ua TEXT)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS visits_ts ON visits (ts)').run();
  // base tables (no-ops when they already exist) so a fresh database works without manual SQL
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, name TEXT, phone TEXT, color INTEGER, copies INTEGER, amount REAL, status TEXT, created_at INTEGER, note TEXT)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT, name TEXT, r2_key TEXT, pages INTEGER)').run();
  const { results } = await env.DB.prepare('PRAGMA table_info(orders)').all();
  const have = new Set(results.map((r) => r.name));
  if (!have.has('paper')) await env.DB.prepare("ALTER TABLE orders ADD COLUMN paper TEXT DEFAULT 'A4'").run();
  if (!have.has('opts')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN opts TEXT').run();
  if (!have.has('pay_url')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN pay_url TEXT').run();
  if (!have.has('pay_status')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN pay_status TEXT').run();
  if (!have.has('pay_intent')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN pay_intent TEXT').run();
  if (!have.has('rzp_order_id')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN rzp_order_id TEXT').run();
  if (!have.has('pay_utr')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN pay_utr TEXT').run();
  if (!have.has('pc_deleted')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN pc_deleted INTEGER DEFAULT 0').run();
  if (!have.has('srv_deleted')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN srv_deleted INTEGER DEFAULT 0').run();
  schemaChecked = true;
}

async function createOrder(request, env) {
  await ensureSchema(env);
  const form = await request.formData();
  let meta;
  try { meta = JSON.parse(form.get('meta') || '{}'); } catch { return json({ error: 'Bad request' }, 400); }
  const files = form.getAll('files').filter((f) => typeof f !== 'string');
  if (!files.length) return json({ error: 'No files' }, 400);
  if (files.length > MAX_FILES) return json({ error: `Max ${MAX_FILES} files` }, 400);

  const kind = meta.kind === 'passport' ? 'passport' : 'doc';
  const paper = PAPERS.includes(meta.paper) ? meta.paper : 'A4';
  const color = (meta.color || paper === '4x6' || kind === 'passport') ? 1 : 0;
  const copies = Math.min(Math.max(parseInt(meta.copies) || 1, 1), kind === 'passport' ? 20 : 100);
  const orient = (Array.isArray(meta.orient) ? meta.orient : []).map((o) => (o === 'landscape' ? 'landscape' : 'portrait'));
  const info = String(meta.info || '').slice(0, 160);
  const pagesList = Array.isArray(meta.pages) ? meta.pages : [];
  const id = newId();
  const now = Date.now();

  // validate every file first, so a bad file never leaves earlier files stored for nothing
  let totalBytes = 0;
  for (const f of files) {
    if (!ALLOWED.includes(ext(f.name))) return json({ error: `File type not allowed: ${f.name}` }, 400);
    if (f.size > MAX_FILE_BYTES) return json({ error: `${f.name} is larger than 25 MB` }, 400);
    totalBytes += f.size;
  }
  if (totalBytes > 100 * 1024 * 1024) return json({ error: 'Total upload is larger than 100 MB' }, 400);

  const rows = [];
  let totalPages = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!ALLOWED.includes(ext(f.name))) return json({ error: `File type not allowed: ${f.name}` }, 400);
    if (f.size > MAX_FILE_BYTES) return json({ error: `${f.name} is larger than 25 MB` }, 400);
    const pages = Math.min(Math.max(parseInt(pagesList[i]) || 1, 1), 2000);
    totalPages += pages;
    const key = `${id}/${i}-${safeName(f.name)}`;
    await env.FILES.put(key, await f.arrayBuffer(), {
      expirationTtl: FILE_TTL,
      metadata: { type: f.type || 'application/octet-stream' },
    });
    rows.push({ name: f.name.slice(0, 120), key, pages });
  }

  const P = await getPrices(env);
  let amount;
  if (kind === 'passport') amount = copies * (paper === '4x6' ? P.passport4x6 : P.passportA4);
  else if (paper === '4x6') amount = totalPages * copies * P.photo4x6;
  else amount = totalPages * copies * (color ? P.color : P.bw) * (paper === 'A3' ? P.a3 : 1);
  amount = Math.round(amount * 100) / 100;
  // AUTO_APPROVE = "1" (variable in Cloudflare) -> print immediately, no counter approval
  const startStatus = clean(env.AUTO_APPROVE) === '1' ? 'approved' : 'pending';
  await expireStale(env);   // unpaid uploads older than 60 minutes are deleted
  // housekeeping: forget orders older than 1 day
  await env.DB.batch([
    env.DB.prepare('DELETE FROM files WHERE order_id IN (SELECT id FROM orders WHERE created_at < ?)').bind(now - 86400000),
    env.DB.prepare('DELETE FROM orders WHERE created_at < ?').bind(now - 86400000),
  ]);
  const stmts = [
    env.DB.prepare('INSERT INTO orders (id,name,phone,color,copies,amount,status,created_at,paper,opts) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id, String(meta.name || '').slice(0, 60), String(meta.phone || '').slice(0, 15), color, copies, amount, startStatus, now,
        paper, JSON.stringify({ kind, orient, info })),
    ...rows.map((r) =>
      env.DB.prepare('INSERT INTO files (order_id,name,r2_key,pages) VALUES (?,?,?,?)').bind(id, r.name, r.key, r.pages)
    ),
  ];
  await env.DB.batch(stmts);
  if (startStatus === 'approved') await ledgerAdd(env, id);
  return json({ id, amount, status: startStatus });
}

async function orderStatus(env, id) {
  await ensureSchema(env);
  let o = await env.DB.prepare('SELECT id,status,amount,copies,color,note,pay_status,pay_url,created_at,pc_deleted,srv_deleted FROM orders WHERE id=?').bind(id).first();
  if (!o) return json({ error: 'Order not found' }, 404);
  if (o.status === 'pending' && o.pay_status !== 'paid' && Date.now() - Number(o.created_at || 0) > UNPAID_TTL_MS) { await expireStale(env); o = { ...o, status: 'expired' }; }
  return json({ id: o.id, status: o.status, amount: o.amount, copies: o.copies, color: o.color, note: o.note, pay_status: o.pay_status || '', paying: !!o.pay_url,
    pc_deleted: Number(o.pc_deleted || 0), srv_deleted: Number(o.srv_deleted || 0) });
}

// ---------------- YOUPI PG webhook: automatic payment confirmation ----------------
// Set in Cloudflare (Settings > Variables and Secrets):  YOUPI_WEBHOOK_SECRET (secret), YOUPI_KEY (merchant public key), optional YOUPI_BASE, YOUPI_AUTO_APPROVE ("0" = only mark paid, counter still approves)
// Merchant PUBLIC key (safe to be visible in the page). The YOUPI_KEY variable in Cloudflare overrides it.
const YOUPI_PUBLIC_KEY = '00000000-0000-0000-0000-000000000001';
const hexOf = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
async function hmacHex(secret, bytes) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hexOf(await crypto.subtle.sign('HMAC', key, bytes));
}
async function youpiWebhook(request, env) {
  const secret = clean(env.YOUPI_WEBHOOK_SECRET);
  if (!secret) return json({ error: 'YOUPI_WEBHOOK_SECRET is not set in Cloudflare' }, 500);
  const raw = new Uint8Array(await request.arrayBuffer());          // signature is over the raw bytes, before any JSON parsing
  const got = (request.headers.get('x-gateway-signature') || '').replace(/^sha256=/, '');
  if (!sameSecret(got, await hmacHex(secret, raw))) return json({ error: 'Invalid webhook signature' }, 401);

  // optional replay protection: when the gateway also sends the timestamp-bound signature, check it and the age
  const ts = request.headers.get('x-gateway-timestamp'), sig2 = (request.headers.get('x-gateway-signature-v2') || '').replace(/^sha256=/, '');
  if (ts && sig2) {
    const joined = new Uint8Array(ts.length + 1 + raw.length);
    joined.set(new TextEncoder().encode(ts + '.')); joined.set(raw, ts.length + 1);
    if (!sameSecret(sig2, await hmacHex(secret, joined))) return json({ error: 'Invalid timestamp signature' }, 401);
    if (Math.abs(Date.now() - Number(ts)) > 2 * 60 * 60 * 1000) return json({ error: 'Stale delivery' }, 401); // gateway retries for up to 1 hour
  }

  let p; try { p = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: 'Bad JSON' }, 400); }
  if (p.event !== 'SUCCESS') return json({ received: true, ignored: true });
  const id = String(p.orderId || '');
  if (!/^[A-Z0-9]+$/.test(id)) return json({ received: true, ignored: 'unknown order' });

  await ensureSchema(env);
  const o = await env.DB.prepare('SELECT id,amount,status,pay_status FROM orders WHERE id=?').bind(id).first();
  if (!o) return json({ received: true, ignored: 'order not found' });          // 200 so the gateway stops retrying (order may have expired)
  if (o.pay_status === 'paid') return json({ received: true, duplicate: true }); // retries / duplicate deliveries are harmless
  const paise = Number.isFinite(Number(p.amountPaise)) ? Math.round(Number(p.amountPaise)) : Math.round(Number(p.amount) * 100);
  if (paise !== Math.round(Number(o.amount) * 100)) return json({ received: true, ignored: 'amount mismatch' }); // never approve a wrong amount
  if (p.currency && String(p.currency).toUpperCase() !== 'INR') return json({ received: true, ignored: 'currency mismatch' });

  const utr = String(p.utr || '').slice(0, 30);
  const auto = clean(env.YOUPI_AUTO_APPROVE) !== '0';
  await env.DB.prepare("UPDATE orders SET pay_status='paid', pay_utr=?, status=CASE WHEN ? AND status IN ('pending','error') THEN 'approved' ELSE status END WHERE id=? AND (pay_status IS NULL OR pay_status<>'paid')")
    .bind(utr, auto ? 1 : 0, id).run();
  if (auto && ['pending', 'error'].includes(o.status)) await ledgerAdd(env, id);
  return json({ received: true });
}


// ---------------- RAZORPAY Standard Web Checkout ----------------
// Cloudflare (Settings > Variables and Secrets):  RAZORPAY_KEY_ID  (text),  RAZORPAY_KEY_SECRET  (SECRET, never sent to the browser),
// optional RAZORPAY_AUTO_APPROVE ("0" = only mark paid, the counter approves printing).
const rzpKeys = (env) => ({ id: clean(env.RAZORPAY_KEY_ID), secret: clean(env.RAZORPAY_KEY_SECRET) });
// Names (never values) of Razorpay variables this deployment cannot see - helps debugging a missing/wrong environment.
const rzpMissing = (env) => ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'].filter((n) => !clean(env[n]));
const rzpPublic = (env) => { const k = rzpKeys(env); return k.id && k.secret ? { keyId: k.id } : null; };   // only the public key id leaves the server

// 1) Create a Razorpay order. The amount always comes from OUR database order, never from the browser.
async function rzpCreateOrder(request, env) {
  const { id: keyId, secret } = rzpKeys(env);
  if (!keyId || !secret) return json({ error: 'Razorpay is not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Cloudflare.' }, 500);
  const b = await request.json().catch(() => ({}));
  const id = String(b.orderId || '');
  if (!/^[A-Z0-9]+$/.test(id)) return json({ error: 'orderId is required' }, 400);
  await ensureSchema(env);
  const o = await env.DB.prepare('SELECT id,amount,status,pay_status,rzp_order_id FROM orders WHERE id=?').bind(id).first();
  if (!o) return json({ error: 'Order not found or expired' }, 404);
  if (o.pay_status === 'paid') return json({ error: 'This order is already paid' }, 409);
  if (!['pending', 'error'].includes(o.status)) return json({ error: 'This order can no longer be paid' }, 409);
  const paise = Math.round(Number(o.amount) * 100);
  if (!Number.isFinite(paise) || paise < 100) return json({ error: 'Amount must be at least ₹1 (100 paise)' }, 400);
  if (o.rzp_order_id) return json({ order_id: o.rzp_order_id, amount: paise, currency: 'INR', key_id: keyId });   // retry: reuse the same Razorpay order

  let r, j;
  try {
    r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Basic ' + btoa(keyId + ':' + secret) },
      body: JSON.stringify({ amount: paise, currency: 'INR', receipt: id, notes: { shop_order: id } }),
    });
    j = await r.json().catch(() => ({}));
  } catch { return json({ error: 'Could not reach Razorpay. Please try again.' }, 500); }
  if (r.status === 401) return json({ error: 'Razorpay authentication failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' }, 401);
  if (!r.ok || !j.id) return json({ error: (j.error && j.error.description) || 'Razorpay could not create the order.' }, 500);
  await env.DB.prepare('UPDATE orders SET rzp_order_id=? WHERE id=?').bind(j.id, id).run();
  return json({ order_id: j.id, amount: j.amount, currency: j.currency, key_id: keyId });
}

// 2) Verify the payment signature: HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET).
async function rzpVerify(request, env) {
  const { secret } = rzpKeys(env);
  if (!secret) return json({ error: 'Razorpay is not configured' }, 500);
  const b = await request.json().catch(() => ({}));
  const id = String(b.orderId || ''), oid = String(b.razorpay_order_id || ''), pid = String(b.razorpay_payment_id || ''), sig = String(b.razorpay_signature || '');
  if (!/^[A-Z0-9]+$/.test(id) || !/^order_\w+$/.test(oid) || !/^pay_\w+$/.test(pid) || !sig) return json({ error: 'Missing or invalid payment fields' }, 400);
  const expected = await hmacHex(secret, new TextEncoder().encode(oid + '|' + pid));
  if (!sameSecret(sig, expected)) return json({ success: false, error: 'Payment signature mismatch' }, 400);   // never mark as paid

  await ensureSchema(env);
  const o = await env.DB.prepare('SELECT id,status,pay_status,rzp_order_id FROM orders WHERE id=?').bind(id).first();
  if (!o) return json({ error: 'Order not found or expired' }, 404);
  if (o.rzp_order_id !== oid) return json({ success: false, error: 'This payment does not belong to this order' }, 400);
  if (o.pay_status === 'paid') return json({ success: true, duplicate: true });
  const auto = clean(env.RAZORPAY_AUTO_APPROVE) !== '0';
  await env.DB.prepare("UPDATE orders SET pay_status='paid', pay_utr=?, status=CASE WHEN ? AND status IN ('pending','error') THEN 'approved' ELSE status END WHERE id=? AND (pay_status IS NULL OR pay_status<>'paid')")
    .bind(pid.slice(0, 30), auto ? 1 : 0, id).run();
  if (auto && ['pending', 'error'].includes(o.status)) await ledgerAdd(env, id);
  return json({ success: true });
}

async function ordersWithFiles(env, statuses, limit = 50) {
  const ph = statuses.map(() => '?').join(',');
  const { results: orders } = await env.DB.prepare(
    `SELECT * FROM orders WHERE status IN (${ph}) ORDER BY created_at DESC LIMIT ${limit}`
  ).bind(...statuses).all();
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);
  const { results: files } = await env.DB.prepare(
    `SELECT id,order_id,name,pages FROM files WHERE order_id IN (${ids.map(() => '?').join(',')}) AND r2_key IS NOT NULL`
  ).bind(...ids).all();
  return orders.map((o) => ({ ...o, files: files.filter((f) => f.order_id === o.id) }));
}

async function ledgerAdd(env, id) {
  try {
    await ensureSchema(env);
    await env.DB.prepare("INSERT OR IGNORE INTO ledger (order_id,ts,amount,copies,pages,paper,color,kind) SELECT o.id, ?, o.amount, o.copies, COALESCE((SELECT SUM(pages) FROM files WHERE order_id=o.id),0), o.paper, o.color, COALESCE(json_extract(o.opts,'$.kind'),'doc') FROM orders o WHERE o.id=?")
      .bind(Date.now(), id).run();
  } catch (e) { /* never block printing because of the statement */ }
}

// GET /api/admin/statement?from=YYYY-MM-DD&to=YYYY-MM-DD (India time, both days included)
async function adminStatement(request, env) {
  await ensureSchema(env);
  const u = new URL(request.url);
  const IST = 19800000, day = 86400000;
  const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) - IST : null; };
  const todayStart = Math.floor((Date.now() + IST) / day) * day - IST;
  const from = parse(u.searchParams.get('from')) ?? todayStart;
  const to = (parse(u.searchParams.get('to')) ?? from) + day;
  const { results } = await env.DB.prepare('SELECT * FROM ledger WHERE ts>=? AND ts<? ORDER BY ts DESC LIMIT 3000').bind(from, to).all();
  const t = results.reduce((a, r) => ({ orders: a.orders + 1, pages: a.pages + (r.pages || 0) * (r.copies || 1), amount: a.amount + (r.amount || 0) }), { orders: 0, pages: 0, amount: 0 });
  return json({ rows: results, totals: t, from, to });
}

async function adminList(env) {
  await ensureSchema(env);
  await expireStale(env);
  return json({ orders: await ordersWithFiles(env, ['pending', 'approved', 'printing', 'error', 'printed', 'rejected'], 40) });
}

async function adminDecide(env, id, action) {
  if (action === 'approve') {
    const r = await env.DB.prepare("UPDATE orders SET status='approved' WHERE id=? AND status IN ('pending','error')").bind(id).run();
    if ((r.meta && r.meta.changes) > 0) await ledgerAdd(env, id);
  } else {
    await env.DB.prepare("UPDATE orders SET status='rejected', name='', phone='' WHERE id=? AND status IN ('pending','approved','printing','error')").bind(id).run();
    await purgeFiles(env, id);
    await env.DB.prepare('DELETE FROM files WHERE order_id=?').bind(id).run(); // forget file names too
  }
  return json({ ok: true });
}

// "Remove all": deletes every order, its files in storage and all customer details.
async function adminClear(env) {
  const { results } = await env.DB.prepare('SELECT r2_key FROM files WHERE r2_key IS NOT NULL').all();
  for (const f of results) await env.FILES.delete(f.r2_key);
  await env.DB.batch([env.DB.prepare('DELETE FROM files'), env.DB.prepare('DELETE FROM orders')]);
  return json({ ok: true, removed: results.length });
}

async function adminMark(request, env, id, action) {
  if (action === 'start') {
    const r = await env.DB.prepare("UPDATE orders SET status='printing' WHERE id=? AND status IN ('pending','approved','error')").bind(id).run();
    if ((r.meta && r.meta.changes) > 0) await ledgerAdd(env, id);
    return json({ ok: true });
  }
  return agentUpdate(request, env, id, 'done', 'admin'); // printed from the counter page: delete files + erase name/phone
}

async function serveFile(env, fileId) {
  const f = await env.DB.prepare('SELECT name,r2_key FROM files WHERE id=?').bind(fileId).first();
  if (!f || !f.r2_key) return json({ error: 'File not found' }, 404);
  const { value, metadata } = await env.FILES.getWithMetadata(f.r2_key, { type: 'arrayBuffer' });
  if (!value) return json({ error: 'File missing (expired?)' }, 404);
  return new Response(value, {
    headers: {
      'content-type': (metadata && metadata.type) || 'application/octet-stream',
      'content-disposition': `inline; filename="${safeName(f.name)}"`,
      'cache-control': 'no-store',
    },
  });
}

async function agentJobs(env) {
  const orders = await ordersWithFiles(env, ['approved'], 20);
  return json({ orders: orders.reverse() }); // oldest first
}

// Privacy: unpaid uploads are deleted after 60 minutes (files and name/phone), never kept "just in case".
const UNPAID_TTL_MS = 60 * 60 * 1000;
async function expireStale(env) {
  const { results } = await env.DB.prepare("SELECT id FROM orders WHERE status='pending' AND (pay_status IS NULL OR pay_status!='paid') AND created_at < ?").bind(Date.now() - UNPAID_TTL_MS).all();
  for (const r of results) {
    await purgeFiles(env, r.id);
    await env.DB.prepare("UPDATE orders SET status='expired', name='', phone='' WHERE id=? AND status='pending'").bind(r.id).run();
    await env.DB.prepare('DELETE FROM files WHERE order_id=?').bind(r.id).run();
  }
}

// Order of events after printing (the customer's tracker shows each one):
//   printed  -> agent says the print was sent
//   done     -> agent says the temp copy is wiped from the shop PC (pc_deleted=1), then the server deletes the file (srv_deleted=1)
// A print started from the counter page never saves the file on the PC, so pc_deleted is stored as 2 ("nothing saved").
async function agentUpdate(request, env, id, action, src = 'agent') {
  await ensureSchema(env);
  if (action === 'claim') {
    const r = await env.DB.prepare("UPDATE orders SET status='printing' WHERE id=? AND status='approved'").bind(id).run();
    return json({ claimed: (r.meta?.changes || 0) > 0 });
  }
  if (action === 'printed') {
    await env.DB.prepare("UPDATE orders SET status='printed', name='', phone='' WHERE id=? AND status IN ('printing','approved')").bind(id).run();
    return json({ ok: true });
  }
  if (action === 'done') {
    const body = src === 'agent' ? await request.json().catch(() => ({})) : {};
    const pc = src === 'admin' ? 2 : (body.pc_deleted ? 1 : 0);
    await env.DB.prepare("UPDATE orders SET status='printed', name='', phone='' WHERE id=?").bind(id).run();
    await purgeFiles(env, id); // privacy: file removed right after printing
    await env.DB.prepare('DELETE FROM files WHERE order_id=?').bind(id).run(); // forget file names too
    await env.DB.prepare('UPDATE orders SET pc_deleted=?, srv_deleted=1 WHERE id=?').bind(pc, id).run();
    return json({ ok: true });
  }
  const body = await request.json().catch(() => ({}));
  await env.DB.prepare("UPDATE orders SET status='error', note=? WHERE id=?")
    .bind(String(body.reason || 'Print failed').slice(0, 200), id).run();
  return json({ ok: true });
}

async function purgeFiles(env, id) {
  const { results } = await env.DB.prepare('SELECT r2_key FROM files WHERE order_id=? AND r2_key IS NOT NULL').bind(id).all();
  for (const f of results) await env.FILES.delete(f.r2_key);
  await env.DB.prepare('UPDATE files SET r2_key=NULL WHERE order_id=?').bind(id).run();
}
