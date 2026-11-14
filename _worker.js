// Cloudflare Pages "advanced mode" worker (_worker.js) — works with drag-and-drop upload.
// Bindings to add in the dashboard:  DB (D1 database)  and  FILES (KV namespace)
// Secrets/variables:  AUTO_APPROVE ("1" = print without counter approval), RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (secret), GOOGLE_CLIENT_ID, ADMIN_EMAILS (comma list of allowed Google accounts), SESSION_SECRET (any long random text; falls back to AGENT_KEY), AGENT_KEY, YOUPI_WEBHOOK_SECRET, optional SHOP_NAME, YOUPI_KEY, YOUPI_BASE, YOUPI_AUTO_APPROVE

// ---- DEFAULT PRICES (rupees) — the counter's 💰 Prices button overrides these (saved in the database) ----
const RATE = { bw: 5, color: 10 };          // A4 per page
const A3_MULTIPLIER = 2;                    // A3 page = A4 price x 2
const PHOTO_4X6 = 20;                       // one 4x6 photo print
const PASSPORT_SHEET = { '4x6': 30, A4: 50 }; // one sheet of passport photos
const PAPERS = ['A4', 'A3', '4x6'];
const PASSPORT_PER_SHEET = 8, PASSPORT_DEFAULT = 6, PASSPORT_MAX = 48;   // WhatsApp option 3: photos on one 4x6 sheet (35x45 mm each) / default count / max per order
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
  async fetch(request, env, ctx) {
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
        return json({ shop: env.SHOP_NAME || 'Digital Seva Kendra', waNumber: clean(env.WA_NUMBER).replace(/\D/g, '') || null, rate: { bw: p.bw, color: p.color }, a3: p.a3, photo4x6: p.photo4x6, passport: { '4x6': p.passport4x6, A4: p.passportA4 }, youpi, razorpay: rzpPublic(env), razorpayMissing: rzpMissing(env) });
      }
      if (path === 'youpi/webhook' && method === 'POST') return youpiWebhook(request, env);
      if (path === 'create-order' && method === 'POST') return rzpCreateOrder(request, env);
      if (path === 'verify-payment' && method === 'POST') return rzpVerify(request, env);
      if (path === 'orders' && method === 'POST') return createOrder(request, env);
      m = path.match(/^orders\/([A-Z0-9]+)$/);
      if (m && method === 'GET') return orderStatus(env, m[1]);

      if (path === 'admin-config' && method === 'GET') return json({ googleClientId: clean(env.GOOGLE_CLIENT_ID) || null, pinLogin: !!(clean(env.ADMIN_PIN) && sessionSecret(env)) });
      if (path === 'admin-pin-login' && method === 'POST') return adminPinLogin(request, env);
      if (path === 'wa/webhook') return waWebhook(request, env, ctx);
      if (path === 'razorpay/webhook' && method === 'POST') return razorpayWebhook(request, env);
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
        if (path === 'admin/settings') return adminSettings(request, env);
        if (path === 'admin/stats' && method === 'GET') return adminStats(env);
        if (path === 'admin/manual-upload' && method === 'POST') return adminManualUpload(request, env);
        m = path.match(/^admin\/cash-approve\/([A-Z0-9]+)$/);
        if (m && method === 'POST') return adminCashApprove(env, m[1]);
        if (path === 'admin/wa-reply' && method === 'POST') return adminWaReply(request, env);
        m = path.match(/^admin\/reprint\/([A-Z0-9]+)$/);
        if (m && method === 'POST') return adminReprint(env, m[1]);
        m = path.match(/^admin\/replace-file\/(\d+)$/);
        if (m && method === 'POST') return adminReplaceFile(request, env, m[1]);
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
        if (path === 'agent/wa/incoming' && method === 'POST') return agentWaIncoming(request, env);
        if (path === 'agent/wa/outbox' && method === 'GET') return agentWaOutbox(env);
        if (path === 'agent/wa/ack' && method === 'POST') return agentWaAck(request, env);
        if (path === 'agent/wa/status' && method === 'POST') return agentWaStatus(request, env);
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
  if (!p || !p.e || !(p.x > Date.now())) return null;
  if (p.e === '__pin__') return clean(env.ADMIN_PIN) && p.k === await pinTag(env) ? { role: 'admin', email: 'pin' } : null;   // changing ADMIN_PIN signs everyone out
  if (!adminEmails(env).includes(String(p.e).toLowerCase())) return null;
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
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS wa_tokens (day TEXT PRIMARY KEY, n INTEGER)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS wa_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, to_id TEXT, text TEXT, ts INTEGER)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS wa_seen (id TEXT PRIMARY KEY, ts INTEGER)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS wa_hits (number TEXT, ts INTEGER, kind TEXT)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS login_fail (ip TEXT, ts INTEGER)').run();
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
  for (const [col, ddl] of [['source', "TEXT DEFAULT 'web'"], ['token', 'TEXT'], ['wa_number', 'TEXT'], ['wa_name', 'TEXT'], ['wa_chat', 'TEXT'], ['printed_at', 'INTEGER'], ['wa_notified', 'INTEGER DEFAULT 0'], ['pay_method', 'TEXT'], ['pay_ref', 'TEXT'], ['paid_at', 'INTEGER']])
    if (!have.has(col)) await env.DB.prepare(`ALTER TABLE orders ADD COLUMN ${col} ${ddl}`).run();
  const lg = (await env.DB.prepare('PRAGMA table_info(ledger)').all()).results.map((r) => r.name);
  if (!lg.includes('pay_method')) await env.DB.prepare('ALTER TABLE ledger ADD COLUMN pay_method TEXT').run();
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
  const auto = await autoOn(env, clean(env.YOUPI_AUTO_APPROVE) !== '0');
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
  const auto = await autoOn(env, clean(env.RAZORPAY_AUTO_APPROVE) !== '0');
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
    await env.DB.prepare("INSERT OR IGNORE INTO ledger (order_id,ts,amount,copies,pages,paper,color,kind,pay_method) SELECT o.id, ?, o.amount, o.copies, COALESCE((SELECT SUM(pages) FROM files WHERE order_id=o.id),0), o.paper, o.color, COALESCE(json_extract(o.opts,'$.kind'),'doc'), COALESCE(o.pay_method, CASE WHEN o.pay_status='paid' THEN 'upi' ELSE 'cash' END) FROM orders o WHERE o.id=?")
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
  await pollPayments(env);
  return json({ orders: await ordersWithFiles(env, ['wa_wait', 'pay_choose', 'pay_wait', 'cash_wait', 'pending', 'approved', 'printing', 'error', 'printed', 'rejected'], 80), flags: await getFlags(env), wa: await waStatus(env) });
}

async function adminDecide(env, id, action) {
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
  if (!o) return json({ error: 'Order not found' }, 404);
  const wa = o.source === 'whatsapp' && o.wa_number;
  if (action === 'approve') {
    if (['wa_wait', 'pay_choose', 'pay_wait', 'cash_wait'].includes(o.status)) return adminCashApprove(env, id);   // the counter took the money (cash) -> print
    const r = await env.DB.prepare("UPDATE orders SET status='approved' WHERE id=? AND status IN ('pending','error')").bind(id).run();
    if ((r.meta && r.meta.changes) > 0) {
      await ledgerAdd(env, id);
      if (wa) await waSend(env, o.wa_number, o.wa_chat, `✅ টোকেন #${o.token || o.id}: আপনার ফাইলটি প্রিন্ট হচ্ছে!\nYour file is printing.`);
    }
  } else {
    if (wa && ['wa_wait', 'pay_choose', 'pay_wait', 'cash_wait', 'pending', 'approved', 'printing', 'error'].includes(o.status)) await waSend(env, o.wa_number, o.wa_chat, `❌ ${o.token ? '#' + o.token + ': ' : ''}আপনার প্রিন্ট অর্ডারটি বাতিল করা হয়েছে।\nYour print order was cancelled by the shop.`);
    if (o.status === 'pay_wait') await razorpayCancel(env, o);
    await env.DB.prepare("UPDATE orders SET status='rejected', name='', phone='', wa_number='', wa_chat='' WHERE id=? AND status IN ('wa_wait','pay_choose','pay_wait','cash_wait','pending','approved','printing','error')").bind(id).run();
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
  await pollPayments(env).catch(() => {});
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
  // WhatsApp files nobody answered for (menu never replied to) are deleted after 60 minutes as well
  const { results: stale } = await env.DB.prepare("SELECT id FROM orders WHERE status IN ('wa_wait','pay_choose','pay_wait') AND created_at < ?").bind(Date.now() - UNPAID_TTL_MS).all();
  for (const r of stale) {
    await purgeFiles(env, r.id);
    await env.DB.prepare("UPDATE orders SET status='expired', name='', phone='', wa_number='', wa_chat='' WHERE id=? AND status IN ('wa_wait','pay_choose','pay_wait')").bind(r.id).run();
    await env.DB.prepare('DELETE FROM files WHERE order_id=?').bind(r.id).run();
  }
  // cash orders may wait for the customer to walk in, but not longer than the files live (2 h)
  const { results: cashOld } = await env.DB.prepare("SELECT id FROM orders WHERE status='cash_wait' AND created_at < ?").bind(Date.now() - 100 * 60000).all();
  for (const r of cashOld) {
    await purgeFiles(env, r.id);
    await env.DB.prepare("UPDATE orders SET status='expired', name='', phone='', wa_number='', wa_chat='' WHERE id=? AND status='cash_wait'").bind(r.id).run();
    await env.DB.prepare('DELETE FROM files WHERE order_id=?').bind(r.id).run();
  }
  // "Keep files for reprint" holds a finished job for 30 minutes at most, then the normal privacy wipe happens
  const { results: kept } = await env.DB.prepare("SELECT id FROM orders WHERE status='printed' AND printed_at IS NOT NULL AND printed_at < ? AND EXISTS (SELECT 1 FROM files f WHERE f.order_id=orders.id AND f.r2_key IS NOT NULL)").bind(Date.now() - 30 * 60000).all();
  for (const r of kept) {
    await purgeFiles(env, r.id);
    await env.DB.prepare("UPDATE orders SET name='', phone='', wa_number='', wa_chat='', srv_deleted=1 WHERE id=?").bind(r.id).run();
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
    const o = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
    if (o && ['printing', 'approved'].includes(o.status)) {
      await waNotifyPrinted(env, o);   // tell the WhatsApp customer, then forget the number (unless the counter keeps the job for reprint)
      const keep = await keepFiles(env);
      await env.DB.prepare(`UPDATE orders SET status='printed', printed_at=?${keep ? '' : ", name='', phone='', wa_number='', wa_chat=''"} WHERE id=? AND status IN ('printing','approved')`).bind(Date.now(), id).run();
    }
    return json({ ok: true });
  }
  if (action === 'done') {
    const body = src === 'agent' ? await request.json().catch(() => ({})) : {};
    const pc = src === 'admin' ? 2 : (body.pc_deleted ? 1 : 0);
    const o = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
    await waNotifyPrinted(env, o);
    if (await keepFiles(env)) {   // counter toggle: keep the job for 30 minutes so 🔄 Reprint works
      await env.DB.prepare("UPDATE orders SET status='printed', printed_at=COALESCE(printed_at,?), pc_deleted=? WHERE id=?").bind(Date.now(), pc, id).run();
      return json({ ok: true, kept: true });
    }
    await env.DB.prepare("UPDATE orders SET status='printed', name='', phone='', wa_number='', wa_chat='' WHERE id=?").bind(id).run();
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


// =====================================================================================================
//  WHATSAPP PRINT BOT · PIN LOGIN · MASTER SETTINGS   (added)
//  Two ways in, ONE brain (waIncoming):
//    A) Self-hosted bridge  -> the shop PC's local-print-server.js posts to /api/agent/wa/incoming and sends the replies it gets back
//    B) Meta Cloud API      -> Meta calls /api/wa/webhook, replies go out through the Graph API
//  Worker variables for WhatsApp:  WA_NUMBER (shop number, digits, e.g. 919876543210 – shown on the website),
//    WA_PROVIDER ("bridge" default | "cloud"),  Cloud API only: WA_TOKEN, WA_PHONE_ID, WA_VERIFY_TOKEN, WA_APP_SECRET
//    Optional: WA_MAX_PER_HOUR (default 10 file messages per customer number per hour)
//  Admin PIN login:  ADMIN_PIN  (+ SESSION_SECRET or AGENT_KEY, which already exist)
// =====================================================================================================

// ---------- settings (saved in the D1 "settings" table, changed from the counter's top bar) ----------
async function getSetting(env, k) {
  try { const r = await env.DB.prepare('SELECT v FROM settings WHERE k=?').bind(k).first(); return r ? r.v : null; } catch { return null; }
}
const setSetting = (env, k, v) => env.DB.prepare('INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k, String(v)).run();
// Master Auto-Print switch. When the counter has never touched it, `fallback` keeps the old behaviour.
async function autoOn(env, fallback) {
  const s = await getSetting(env, 'autoprint');
  return s === '1' ? true : s === '0' ? false : !!fallback;
}
async function keepFiles(env) { return (await getSetting(env, 'keepfiles')) === '1'; }
async function getFlags(env) {
  return { autoprint: await autoOn(env, true), wabot: (await getSetting(env, 'wabot')) === 'instant' ? 'instant' : 'ask', keepfiles: await keepFiles(env) };
}
const waProvider = (env) => (clean(env.WA_PROVIDER).toLowerCase() === 'cloud' ? 'cloud' : 'bridge');
async function waStatus(env) {
  let s = {};
  try { s = JSON.parse((await getSetting(env, 'wa_status')) || '{}'); } catch {}
  const age = Date.now() - Number(s.ts || 0);
  const provider = waProvider(env);
  if (provider === 'cloud') return { provider, online: !!(clean(env.WA_TOKEN) && clean(env.WA_PHONE_ID)), state: 'cloud' };
  return { provider, online: age < 60000, state: age < 60000 ? s.state || 'starting' : 'offline', qr: age < 60000 && s.state === 'qr' ? s.qr || '' : '', number: s.number || '', printer: s.printer || '', age };
}
async function adminSettings(request, env) {
  if (request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (b.autoprint !== undefined) await setSetting(env, 'autoprint', b.autoprint ? '1' : '0');
    if (b.wabot !== undefined) await setSetting(env, 'wabot', b.wabot === 'instant' ? 'instant' : 'ask');
    if (b.keepfiles !== undefined) await setSetting(env, 'keepfiles', b.keepfiles ? '1' : '0');
  }
  return json({ flags: await getFlags(env), wa: await waStatus(env) });
}

// ---------- admin PIN login (same signed session as the Google login; no password is stored in the browser) ----------
async function pinTag(env) { return (await hmacHex(sessionSecret(env), new TextEncoder().encode('pin:' + clean(env.ADMIN_PIN)))).slice(0, 20); }
async function adminPinLogin(request, env) {
  const pin = clean(env.ADMIN_PIN);
  if (!pin || !sessionSecret(env)) return json({ error: 'PIN login is not set up. In Cloudflare add ADMIN_PIN and SESSION_SECRET, then redeploy.' }, 500);
  await ensureSchema(env);
  const ip = (request.headers.get('cf-connecting-ip') || 'x').slice(0, 64), now = Date.now();
  await env.DB.prepare('DELETE FROM login_fail WHERE ts<?').bind(now - 15 * 60000).run();
  const f = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_fail WHERE ip=?').bind(ip).first();
  if (f && Number(f.n) >= 5) return json({ error: 'Too many wrong attempts. Please wait 15 minutes.' }, 429);
  const b = await request.json().catch(() => ({}));
  if (!sameSecret(String(b.pin || '').slice(0, 64), pin)) {
    await env.DB.prepare('INSERT INTO login_fail (ip, ts) VALUES (?,?)').bind(ip, now).run();
    return json({ error: 'Wrong PIN' }, 401);
  }
  await env.DB.prepare('DELETE FROM login_fail WHERE ip=?').bind(ip).run();
  const payload = b64u(JSON.stringify({ e: '__pin__', x: now + 14 * 86400000, k: await pinTag(env) }));
  return json({ session: payload + '.' + await hmacHex(sessionSecret(env), new TextEncoder().encode(payload)), email: 'Admin PIN' });
}

// ---------- helpers ----------
const MIME_EXT = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};
const istDay = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
const rupee = (n) => '₹' + String(Math.round(Number(n) * 100) / 100);
function pdfPages(buf) {          // good-enough page counter for the Cloud API path (the PC bridge counts exactly with pdf-lib)
  try {
    const s = new TextDecoder('latin1').decode(new Uint8Array(buf));
    const n = (s.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
    if (n) return Math.min(n, 2000);
    let max = 0; for (const m of s.matchAll(/\/Count\s+(\d+)/g)) max = Math.max(max, Number(m[1]));
    return Math.min(Math.max(max, 1), 2000);
  } catch { return 1; }
}
// "2 bw", "1 color", "color", "bw 3 copies", "2 কালার"  ->  { mode: 'bw'|'color'|null, copies }
function parsePrintCaption(text) {
  const t = String(text || '').toLowerCase();
  const color = /colou?r|rangin|rongin|রঙিন|রঙীন|কালার/.test(t);
  const bw = /(^|[^a-z])b\s*&\s*w([^a-z]|$)|(^|[^a-z])bw([^a-z]|$)|b\/w|black|mono|sada|সাদা|কালো/.test(t);
  const n = t.match(/(\d{1,3})/);
  const copies = Math.min(Math.max(n ? parseInt(n[1]) : 1, 1), 100);
  return { mode: color ? 'color' : bw ? 'bw' : null, copies, onlyNumber: /^\s*\d{1,3}\s*(copies|copy|কপি)?\s*$/.test(t) };
}
// customer's reply to the menu:  1 | 2 | 3 | "1 x3" | "2 3" | "bw" | "color" | 0 / cancel
function parseChoice(text) {
  let t = String(text || '').normalize('NFKC').trim().toLowerCase()                       // full-width / compat forms -> plain ASCII
    .replace(/[\u09E6-\u09EF]/g, (d) => String(d.charCodeAt(0) - 0x09E6));                // Bengali digits ০-৯ -> 0-9
  if (/^(0|cancel|stop|বাতিল)$/.test(t)) return { cancel: true };
  t = t.replace(/[\u2715\u2716\u00d7\u2a2f]/g, 'x').replace(/\s+/g, ' ');               // ✕ ✖ × -> x
  const m = /^([1-3])(?:\s*(?:x|\*|-|:)?\s*(\d{1,3})(?:\s*(?:copies|copy|কপি|pcs|photos?))?)?$/.exec(t);   // "2x5" "2 x 5" "2*5" "2 5" "3x8"
  if (m) return { opt: Number(m[1]), copies: m[2] ? Math.min(Math.max(parseInt(m[2], 10), 1), 100) : null };
  const c = parsePrintCaption(t);
  if (c.mode) return { opt: c.mode === 'color' ? 2 : 1, copies: c.copies };
  return {};
}
async function nextWaToken(env) {   // #WA-101, #WA-102 … restarts every day (India time)
  const r = await env.DB.prepare('INSERT INTO wa_tokens (day,n) VALUES (?,101) ON CONFLICT(day) DO UPDATE SET n=n+1 RETURNING n').bind(istDay()).first();
  return 'WA-' + r.n;
}
function waMenuText(pages, P, copies) {
  return `📄 আপনার ফাইল পাওয়া গেছে (Pages: ${pages})! প্রিন্ট করতে নিচের নম্বর রিপ্লাই দিন:\n` +
    `1️⃣ সাদাকালো প্রিন্ট (B&W - ${rupee(P.bw)}/p)\n2️⃣ কালার প্রিন্ট (Color - ${rupee(P.color)}/p)\n3️⃣ পাসপোর্ট ফটো / কার্ড প্রিন্ট\n\n` +
    `Your file is received (${pages} page${pages > 1 ? 's' : ''}). Reply 1, 2 or 3.\n` +
    `কপি / copies: "1 x3" = B&W × 3${copies > 1 ? `\n(এখন ${copies} কপি সেট আছে / ${copies} copies set)` : ''}\n❌ বাতিল / cancel: 0`;
}
const WA_WELCOME = '👋 নমস্কার! Digital Seva Kendra-তে স্বাগতম।\nপ্রিন্ট করতে আপনার PDF / ছবি / ডকুমেন্ট এখানেই পাঠান।\nক্যাপশনে লিখতে পারেন: "2 bw" (২ কপি সাদাকালো) বা "1 color".\n\nSend your PDF / photo / document here to print it. Caption example: "2 bw" or "1 color".';

// ---------- sending ----------
async function waCloudSend(env, to, text) {
  const id = clean(env.WA_PHONE_ID), tok = clean(env.WA_TOKEN);
  if (!id || !tok) throw new Error('WA_PHONE_ID / WA_TOKEN not set');
  const r = await fetch(`https://graph.facebook.com/v21.0/${id}/messages`, {
    method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: String(text).slice(0, 3800), preview_url: false } }),
  });
  if (!r.ok) throw new Error('WhatsApp send failed: ' + (await r.text()).slice(0, 200));
}
// Messages the shop sends on its own (printed notice, counter replies). Bridge mode: queued, the PC picks them up within ~2 s.
async function waSend(env, number, chat, text) {
  if (!number || !text) return;
  try {
    if (waProvider(env) === 'cloud') await waCloudSend(env, number, text);
    else await env.DB.prepare('INSERT INTO wa_outbox (to_id, text, ts) VALUES (?,?,?)').bind(chat || (number + '@c.us'), String(text).slice(0, 3800), Date.now()).run();
  } catch (e) { /* a failed courtesy message must never block printing */ }
}
async function waNotifyPrinted(env, o) {
  if (!o || o.source !== 'whatsapp' || !o.wa_number || o.wa_notified) return;
  await env.DB.prepare('UPDATE orders SET wa_notified=1 WHERE id=?').bind(o.id).run();
  await waSend(env, o.wa_number, o.wa_chat, `🖨️ টোকেন #${o.token || o.id}: আপনার প্রিন্ট হয়ে গেছে! কাউন্টার থেকে নিয়ে নিন${Number(o.amount) ? ` (মোট ${rupee(o.amount)})` : ''}। ধন্যবাদ! 🙏\nYour print is ready — please collect it at the counter.`);
}

// ---------- the bot ----------
async function waFinalize(env, id, ch, flags) {
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
  if (!o) return { text: '' };
  const P = await getPrices(env);
  const pages = Number((await env.DB.prepare('SELECT COALESCE(SUM(pages),0) AS p FROM files WHERE order_id=?').bind(id).first()).p) || 1;
  const copies = Math.min(Math.max(parseInt(ch.copies) || o.copies || 1, 1), 100);
  const token = o.token || await nextWaToken(env);
  if (ch.passport) {   // option 3: the shopkeeper prepares a passport / card sheet by hand
    await env.DB.prepare("UPDATE orders SET status='pending', color=1, copies=?, amount=0, token=?, note=?, opts=? WHERE id=? AND status IN ('wa_wait','pending')")
      .bind(copies, token, 'Passport / card request – please prepare the sheet and talk to the customer', JSON.stringify({ kind: 'passport', source: 'whatsapp', info: 'Customer chose option 3 (passport photo / card)' }), id).run();
    return { token, text: `🪪 টোকেন #${token}: ঠিক আছে! পাসপোর্ট ফটো / কার্ডের জন্য দোকান থেকে আপনাকে জানানো হবে।\nWe'll get back to you shortly about your passport photo / card print.` };
  }
  const color = ch.color ? 1 : 0;
  const amount = Math.round(pages * copies * (color ? P.color : P.bw) * 100) / 100;
  const auto = !!flags.autoprint;
  const status = auto ? 'approved' : 'pending';    // 'approved' == READY_TO_PRINT: the PC agent picks it up
  const r = await env.DB.prepare("UPDATE orders SET color=?, copies=?, amount=?, status=?, token=?, paper='A4' WHERE id=? AND status IN ('wa_wait','pending')").bind(color, copies, amount, status, token, id).run();
  if (!((r.meta && r.meta.changes) > 0)) return { token, text: '' };
  if (auto) await ledgerAdd(env, id);
  const sum = `${pages} page${pages > 1 ? 's' : ''} × ${copies} ${color ? 'Color' : 'B&W'} = ${rupee(amount)}`;
  return { token, text: auto
    ? `✅ টোকেন #${token}: আপনার ফাইলটি প্রিন্ট হচ্ছে!\n${sum}\nপ্রিন্ট হলে জানাব — কাউন্টারে এসে টাকা দিন।\nYour file is printing. Pay at the counter.`
    : `✅ টোকেন #${token}: আপনার ফাইল জমা হয়েছে!\n${sum}\nদোকান থেকে অনুমোদন হলেই প্রিন্ট শুরু হবে।\nWaiting for the shop to approve — we'll message you.` };
}

// m = { from, chat, name, text, files: [{ name, bytes: ArrayBuffer, pages? }] }  ->  array of reply texts
async function waIncoming(env, m) {
  await ensureSchema(env);
  const number = String(m.from || '').replace(/\D/g, '').slice(0, 15);
  if (!number) return [];
  const chat = String(m.chat || '').slice(0, 80), name = String(m.name || '').slice(0, 60);
  const text = String(m.text || '').trim().slice(0, 500);
  const now = Date.now();
  const flags = await getFlags(env), P = await getPrices(env);
  const replies = [];
  const files = Array.isArray(m.files) ? m.files : [];
  await env.DB.prepare('DELETE FROM wa_hits WHERE ts<?').bind(now - 2 * 3600000).run();
  const waiting = await env.DB.prepare("SELECT * FROM orders WHERE source='whatsapp' AND wa_number=? AND status='wa_wait' AND created_at>? ORDER BY created_at DESC LIMIT 1").bind(number, now - UNPAID_TTL_MS).first();

  // ---- a file (or several) arrived ----
  if (files.length) {
    const limit = Number(env.WA_MAX_PER_HOUR) || 10;
    const hits = await env.DB.prepare("SELECT COUNT(*) AS n FROM wa_hits WHERE number=? AND kind='file' AND ts>?").bind(number, now - 3600000).first();
    if (Number(hits.n) >= limit) return ['⏳ একসাথে অনেক ফাইল পাঠানো হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।\nToo many files in a short time — please try again later.'];
    await env.DB.prepare("INSERT INTO wa_hits (number, ts, kind) VALUES (?,?,'file')").bind(number, now).run();

    const ok = [], bad = [];
    for (const f of files) {
      const x = ext(f.name || '');
      if (!ALLOWED.includes(x)) bad.push(f.name || 'file');
      else if (!f.bytes || f.bytes.byteLength > MAX_FILE_BYTES || !f.bytes.byteLength) bad.push((f.name || 'file') + ' (25 MB+)');
      else ok.push(f);
    }
    if (bad.length) replies.push(`⚠️ এই ফাইল নেওয়া যায়নি / not accepted: ${bad.join(', ')}\nসাপোর্টেড: PDF, JPG, PNG, Word, Excel, PowerPoint (২৫ MB পর্যন্ত)`);
    if (!ok.length) return replies;

    let id, isNew = !waiting, have = 0;
    if (waiting) { id = waiting.id; have = Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM files WHERE order_id=?').bind(id).first()).n); }
    if (have + ok.length > MAX_FILES) return replies.concat([`⚠️ একসাথে সর্বোচ্চ ${MAX_FILES}টি ফাইল। / Max ${MAX_FILES} files per order.`]);
    if (isNew) {
      id = newId();
      await env.DB.prepare("INSERT INTO orders (id,name,phone,color,copies,amount,status,created_at,paper,opts,source,wa_number,wa_name,wa_chat) VALUES (?,?,?,0,1,0,'wa_wait',?,'A4',?,'whatsapp',?,?,?)")
        .bind(id, name, number, now, JSON.stringify({ kind: 'doc', source: 'whatsapp' }), number, name, chat).run();
    } else if (chat) await env.DB.prepare('UPDATE orders SET wa_chat=? WHERE id=?').bind(chat, id).run();
    let i = have;
    for (const f of ok) {
      const pages = Math.min(Math.max(parseInt(f.pages) || (ext(f.name) === 'pdf' ? pdfPages(f.bytes) : 1), 1), 2000);
      const key = `${id}/${i++}-${safeName(f.name)}`;
      await env.FILES.put(key, f.bytes, { expirationTtl: FILE_TTL, metadata: { type: f.mime || 'application/octet-stream' } });
      await env.DB.prepare('INSERT INTO files (order_id,name,r2_key,pages) VALUES (?,?,?,?)').bind(id, String(f.name).slice(0, 120), key, pages).run();
    }
    const total = Number((await env.DB.prepare('SELECT COALESCE(SUM(pages),0) AS p FROM files WHERE order_id=?').bind(id).first()).p) || 1;
    const pc = parsePrintCaption(text);
    const mode = pc.mode || (flags.wabot === 'instant' ? 'bw' : null);
    if (mode) {
      const r = await waFinalize(env, id, { color: mode === 'color', copies: pc.copies }, flags);
      if (r.text) replies.push(r.text);
    } else {
      const copies = pc.onlyNumber ? pc.copies : 1;
      if (copies > 1) await env.DB.prepare('UPDATE orders SET copies=? WHERE id=?').bind(copies, id).run();
      replies.push(isNew ? waMenuText(total, P, copies) : `➕ ফাইল যোগ হয়েছে (মোট Pages: ${total})। এবার 1 / 2 / 3 রিপ্লাই দিন।\nFile added (total ${total} pages). Reply 1, 2 or 3.`);
    }
    return replies;
  }

  // ---- plain text ----
  if (!waiting) {   // nothing pending: greet once in a while, never chat endlessly
    const seen = await env.DB.prepare("SELECT 1 AS x FROM wa_hits WHERE number=? AND kind='welcome' AND ts>? LIMIT 1").bind(number, now - 30 * 60000).first();
    if (seen) return [];
    await env.DB.prepare("INSERT INTO wa_hits (number, ts, kind) VALUES (?,?,'welcome')").bind(number, now).run();
    return [WA_WELCOME];
  }
  const ch = parseChoice(text);
  if (ch.cancel) {
    await env.DB.prepare("UPDATE orders SET status='rejected', name='', phone='', wa_number='', wa_chat='' WHERE id=? AND status='wa_wait'").bind(waiting.id).run();
    await purgeFiles(env, waiting.id); await env.DB.prepare('DELETE FROM files WHERE order_id=?').bind(waiting.id).run();
    return ['❌ বাতিল হয়েছে, ফাইল মুছে ফেলা হয়েছে।\nCancelled — your file was deleted.'];
  }
  if (ch.opt) {
    const r = await waFinalize(env, waiting.id, { color: ch.opt === 2, passport: ch.opt === 3, copies: ch.copies || waiting.copies }, flags);
    return r.text ? [r.text] : [];
  }
  return ['🙏 অনুগ্রহ করে 1, 2 বা 3 লিখে রিপ্লাই দিন।\n1 = সাদাকালো (B&W) · 2 = কালার · 3 = পাসপোর্ট/কার্ড · 0 = বাতিল\nPlease reply 1, 2 or 3 (0 to cancel).'];
}

// ---------- A) PC bridge endpoints (protected by the agent key) ----------
async function agentWaIncoming(request, env) {
  let meta = {}, files = [];
  if ((request.headers.get('content-type') || '').includes('application/json')) meta = await request.json().catch(() => ({}));
  else {
    const form = await request.formData();
    try { meta = JSON.parse(form.get('meta') || '{}'); } catch {}
    const fl = form.getAll('files').filter((f) => typeof f !== 'string');
    for (let i = 0; i < fl.length; i++) {
      const mf = (meta.files || [])[i] || {};
      files.push({ name: String(mf.name || fl[i].name || 'file'), mime: String(mf.mime || fl[i].type || ''), pages: mf.pages, bytes: await fl[i].arrayBuffer() });
    }
  }
  BOT_LOG = [];
  const replies = await waIncoming2(env, { from: meta.from, chat: meta.chat, name: meta.name, text: meta.text, files });
  return json({ replies, logs: BOT_LOG.splice(0) });
}
async function agentWaOutbox(env) {
  await ensureSchema(env);
  await env.DB.prepare('DELETE FROM wa_outbox WHERE ts<?').bind(Date.now() - 86400000).run();
  const { results } = await env.DB.prepare('SELECT id, to_id, text FROM wa_outbox ORDER BY id LIMIT 20').all();
  return json({ messages: results });
}
async function agentWaAck(request, env) {
  const b = await request.json().catch(() => ({}));
  for (const id of (Array.isArray(b.ids) ? b.ids : []).slice(0, 50)) await env.DB.prepare('DELETE FROM wa_outbox WHERE id=?').bind(Number(id) || 0).run();
  return json({ ok: true });
}
async function agentWaStatus(request, env) {
  await ensureSchema(env);
  const b = await request.json().catch(() => ({}));
  const state = ['starting', 'qr', 'authenticated', 'ready', 'disconnected', 'error'].includes(b.state) ? b.state : 'starting';
  await setSetting(env, 'wa_status', JSON.stringify({ state, qr: state === 'qr' ? String(b.qr || '').slice(0, 600) : '', number: String(b.number || '').slice(0, 20), printer: String(b.printer || '').slice(0, 80), ts: Date.now() }));
  return json({ ok: true });
}

// ---------- B) Meta WhatsApp Cloud API webhook ----------
async function waWebhook(request, env, ctx) {
  if (request.method === 'GET') {            // Meta's one-time "verify" handshake
    const u = new URL(request.url);
    if (u.searchParams.get('hub.mode') === 'subscribe' && sameSecret(u.searchParams.get('hub.verify_token'), env.WA_VERIFY_TOKEN)) return new Response(u.searchParams.get('hub.challenge') || '', { status: 200 });
    return new Response('Forbidden', { status: 403 });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = clean(env.WA_APP_SECRET);
  if (!secret) return json({ error: 'WA_APP_SECRET is not set' }, 500);
  const raw = new Uint8Array(await request.arrayBuffer());
  const got = (request.headers.get('x-hub-signature-256') || '').replace(/^sha256=/, '');
  if (!sameSecret(got, await hmacHex(secret, raw))) return json({ error: 'Invalid signature' }, 401);
  let p; try { p = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: 'Bad JSON' }, 400); }
  const job = waCloudProcess(env, p).catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
  return json({ received: true });          // answer Meta fast; the work continues in the background
}
async function waCloudMedia(env, mediaId) {
  const h = { authorization: 'Bearer ' + clean(env.WA_TOKEN) };
  const meta = await (await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`, { headers: h })).json();
  if (!meta.url) throw new Error('media url missing');
  const r = await fetch(meta.url, { headers: h });
  if (!r.ok) throw new Error('media download failed');
  return { bytes: await r.arrayBuffer(), mime: meta.mime_type || '' };
}
async function waCloudProcess(env, p) {
  await ensureSchema(env);
  for (const entry of p.entry || []) for (const ch of entry.changes || []) {
    const v = ch.value || {}, names = {};
    for (const c of v.contacts || []) names[c.wa_id] = (c.profile && c.profile.name) || '';
    for (const msg of v.messages || []) {
      const seen = await env.DB.prepare('INSERT OR IGNORE INTO wa_seen (id, ts) VALUES (?,?)').bind(String(msg.id || ''), Date.now()).run();
      if (!(seen.meta && seen.meta.changes > 0)) continue;                    // Meta retries deliveries: handle each message once
      if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM wa_seen WHERE ts<?').bind(Date.now() - 2 * 86400000).run();
      const m = { from: msg.from, name: names[msg.from] || '', text: '', files: [] };
      try {
        if (msg.type === 'text') m.text = (msg.text && msg.text.body) || '';
        else if (msg.type === 'image' || msg.type === 'document') {
          const media = msg[msg.type] || {};
          const got = await waCloudMedia(env, media.id);
          const mime = got.mime || media.mime_type || '';
          const name = media.filename || `whatsapp-${String(msg.id).slice(-8)}.${MIME_EXT[mime.split(';')[0]] || (msg.type === 'image' ? 'jpg' : 'pdf')}`;
          m.text = media.caption || '';
          m.files.push({ name, mime, bytes: got.bytes });
        } else if (msg.type === 'button') m.text = (msg.button && msg.button.text) || '';
        else if (msg.type === 'interactive') m.text = (msg.interactive && ((msg.interactive.button_reply || {}).id || (msg.interactive.list_reply || {}).id)) || '';
        else continue;
        for (const t of await waIncoming2(env, m)) await waCloudReply(env, msg.from, t);
      } catch (e) { await waSend(env, msg.from, '', '⚠️ ফাইলটি নেওয়া যায়নি, আবার পাঠান। / Could not receive that file, please send it again.'); }
    }
  }
}

// ---------- counter actions ----------
async function adminWaReply(request, env) {
  const b = await request.json().catch(() => ({}));
  const id = String(b.id || ''), text = String(b.text || '').trim().slice(0, 1000);
  if (!/^[A-Z0-9]+$/.test(id) || !text) return json({ error: 'Message is empty' }, 400);
  const o = await env.DB.prepare('SELECT wa_number, wa_chat FROM orders WHERE id=?').bind(id).first();
  if (!o || !o.wa_number) return json({ error: 'This customer\'s number is no longer stored (the order was already finished).' }, 404);
  await waSend(env, o.wa_number, o.wa_chat, text);
  return json({ ok: true });
}
// 🔄 Reprint: only possible while the files are still kept (counter toggle "Keep files for reprint", 30 min)
async function adminReprint(env, id) {
  const o = await env.DB.prepare('SELECT status FROM orders WHERE id=?').bind(id).first();
  if (!o) return json({ error: 'Order not found' }, 404);
  const f = await env.DB.prepare('SELECT r2_key FROM files WHERE order_id=? AND r2_key IS NOT NULL LIMIT 1').bind(id).first();
  const alive = f ? await env.FILES.get(f.r2_key, 'stream') : null;
  if (!alive) return json({ error: 'The file was already deleted for privacy. Turn on "Keep files for reprint" before printing next time.' }, 410);
  try { await alive.cancel(); } catch {}
  await env.DB.prepare("UPDATE orders SET status='approved', printed_at=NULL, note=NULL WHERE id=?").bind(id).run();
  return json({ ok: true });
}
// ✂️ Crop / rotate: the counter uploads the edited image over the original
async function adminReplaceFile(request, env, fileId) {
  const f = await env.DB.prepare('SELECT r2_key FROM files WHERE id=?').bind(fileId).first();
  if (!f || !f.r2_key) return json({ error: 'File not found' }, 404);
  const type = (request.headers.get('content-type') || '').split(';')[0];
  if (!['image/jpeg', 'image/png'].includes(type)) return json({ error: 'Only JPEG or PNG can be replaced' }, 400);
  const buf = await request.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_FILE_BYTES) return json({ error: 'Bad file size' }, 400);
  await env.FILES.put(f.r2_key, buf, { expirationTtl: FILE_TTL, metadata: { type } });
  return json({ ok: true });
}


// =====================================================================================================
//  PAYMENT-GATED WHATSAPP FLOW  (v2)   file -> B&W/Color -> UPI QR or Cash -> print
//  Statuses:  wa_wait (choose B&W/Color) -> pay_choose (choose UPI/Cash) -> pay_wait (UPI link sent) | cash_wait (cash, waits for the counter)
//             -> approved (= PAID_READY_TO_PRINT / APPROVED_TO_PRINT) -> printing -> printed
//  Worker variables:  RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (already used by the website checkout),
//     RAZORPAY_WEBHOOK_SECRET (Razorpay dashboard > Webhooks, URL https://therajesh.shop/api/razorpay/webhook,
//        events: payment_link.paid, payment.captured, qr_code.credited),   optional RAZORPAY_MODE ("link" default | "qr")
// =====================================================================================================
const WA_ACTIVE = ['wa_wait', 'pay_choose', 'pay_wait', 'cash_wait'];
const shopName = (env) => clean(env.SHOP_NAME) || 'Digital Seva Kendra';

function waStep1Text(files, pages, P, env) {
  const first = files[0] ? files[0].name : 'file';
  const label = files.length > 1 ? `${first} +${files.length - 1}` : first;
  return `🌟 *স্বাগতম ${shopName(env)} (therajesh.shop)!*\n` +
    `📄 *ফাইল পাওয়া গেছে:* \`${label}\` (${pages} Pages)\n\n` +
    `প্রিন্ট করার জন্য নিচের যেকোনো একটি নম্বর লিখে রিপ্লাই দিন:\n` +
    `*1️⃣ সাদাকালো প্রিন্ট (B&W)* — ${rupee(pages * P.bw)}\n` +
    `*2️⃣ রঙিন প্রিন্ট (Color)* — ${rupee(pages * P.color)}\n` +
    `*3️⃣ পাসপোর্ট সাইজ ফটো প্রিন্ট (Passport Photo)* — ${rupee(P.passport4x6)} / ৪×৬ শিট (${PASSPORT_DEFAULT}টি ছবি; ব্যাকগ্রাউন্ড অটো সাদা)\n\n` +
    `💡 *টিপস: একাধিক কপি চাইলে লিখুন \`1x3\` (৩ কপি সাদাকালো), \`2x5\` (৫ কপি কালার) বা \`3x8\` (৮টি পাসপোর্ট ছবি)*\n` +
    `_English: reply 1 for B&W, 2 for Color or 3 for Passport photos (send a clear JPG/PNG photo). Example "2x5" = 5 color copies. Send 0 to cancel._`;
}
function waStep2Text(token, color, pages, copies, total, kind) {
  const what = kind === 'passport'
    ? `পাসপোর্ট সাইজ ফটো (${copies}টি ছবি, ${Math.ceil(copies / PASSPORT_PER_SHEET)} শিট ৪×৬)`
    : `${color ? 'রঙিন (Color)' : 'সাদাকালো (B&W)'} (${pages} পৃষ্ঠা × ${copies} কপি)`;
  return `🧾 *অর্ডার সামারি (Token: #${token})*\n` +
    `• প্রিন্ট: ${what}\n` +
    `• মোট বিল: *${rupee(total)}*\n\n` +
    `পেমেন্ট কীভাবে করতে চান? নিচের নম্বর রিপ্লাই দিন:\n` +
    `*1️⃣ Online UPI / QR Code* *(পেমেন্ট করলেই অটোমেটিক প্রিন্ট বের হবে ⚡)*\n` +
    `*2️⃣ Cash at Counter* *(কাউন্টারে নগদ টাকা দিয়ে প্রিন্ট নিন 💵)*\n` +
    `_English: reply 1 to pay by UPI now, or 2 to pay cash at the counter._`;
}
const waPayText = (total, url) =>
  `📲 *উপরের QR কোডটি স্ক্যান করুন অথবা নিচের লিঙ্কে ক্লিক করে ${rupee(total)} পেমেন্ট করুন:*\n🔗 ${url}\n\n⚡ *পেমেন্ট সম্পূর্ণ হতেই আপনার প্রিন্ট অটোমেটিক বের হয়ে আসবে!*\n_English: scan the QR or open the link and pay ${rupee(total)}. Printing starts automatically. Reply 2 to pay cash instead._`;
const waPaidText = (total, printing) =>
  `✅ *পেমেন্ট সফল হয়েছে (${rupee(total)})!*\n` + (printing
    ? `🖨️ *আপনার ফাইলটি এখন প্রিন্টার থেকে প্রিন্ট হচ্ছে... অনুগ্রহ করে কাউন্টার থেকে সংগ্রহ করুন।*`
    : `⏳ *দোকান থেকে অনুমোদন হলেই প্রিন্ট শুরু হবে — একটু অপেক্ষা করুন।*`);
const waCashText = (token, total) =>
  `💵 *ক্যাশ পেমেন্ট সিলেক্ট করা হয়েছে (Token: #${token})*\nকাউন্টারে এসে টোকেন নম্বর *#${token}* বলুন এবং *${rupee(total)}* পেমেন্ট করুন। পেমেন্ট অনুমোদন করলেই প্রিন্ট বের হবে।\n_English: please come to the counter, tell token #${token} and pay ${rupee(total)} — printing starts after the shop confirms._`;
const WA_CASH_OK = '✅ ক্যাশ পেমেন্ট গৃহীত হয়েছে! আপনার প্রিন্ট বের হচ্ছে।\n_Cash received — your print is coming out._';

const orderTotals = async (env, id) => {
  const r = await env.DB.prepare('SELECT COALESCE(SUM(pages),0) AS p, COUNT(*) AS n FROM files WHERE order_id=?').bind(id).first();
  return { pages: Number(r.p) || 1, n: Number(r.n) || 0 };
};

// ---------- Razorpay: payment link (default) or UPI QR code for ONE order ----------
// Bot Log lines produced while handling the current WhatsApp message; returned to the PC bridge (`logs`) and printed in the Agent's Bot Log.
let BOT_LOG = [];
const botLog = (m) => { try { console.log(m); BOT_LOG.push(String(m).slice(0, 300)); } catch {} };

// Razorpay accepts customer.contact only when it is 8-14 characters long. WhatsApp may hand us "9198...:12@s.whatsapp.net",
// "1234567890123456@lid" (a Local Identifier, NOT a phone number) or a bare number. Returns a valid contact string, or null (-> the key is NOT sent at all).
function rzpContact(raw, chat) {
  const s0 = String(raw == null ? '' : raw).trim();
  if (!s0 || /@lid\b/i.test(s0)) return null;                // @lid = privacy id, never a dialable number
  const digits = s0.split('@')[0].split(':')[0].replace(/\D/g, '');          // strip "@..." and ":device", keep digits only
  if (/@lid$/i.test(String(chat || '')) && digits === String(chat).split('@')[0].replace(/\D/g, '')) return null;   // number column holds the lid digits
  if (digits.length === 10) return '+91' + digits;           // Indian mobile -> +91XXXXXXXXXX (13 chars)
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  if (digits.length >= 8 && digits.length <= 14) return digits;
  return null;                                               // empty, < 8 or > 14 digits (e.g. a 15+ digit id)
}
async function razorpayCreate(env, o) {
  const { id: keyId, secret } = rzpKeys(env);
  if (!keyId || !secret) { botLog('⚠️ Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing)'); return null; }
  const auth = 'Basic ' + btoa(keyId + ':' + secret), paise = Math.round(Number(o.amount) * 100);
  const notes = { shop_order: o.id, token: o.token || '', phone: String(o.wa_number || '').slice(0, 20) };
  const desc = `Print ${o.token ? '#' + o.token : o.id} – therajesh.shop`;
  const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: auth }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = j.error || {};
      botLog(`❌ Razorpay API error ${r.status} on ${url.split('/v1/')[1]} (order ${o.id}): ${e.description || 'no description'}${e.field ? ' [field: ' + e.field + ']' : ''}${e.code ? ' [' + e.code + ']' : ''}`);
      throw new Error(e.description || 'Razorpay error ' + r.status);
    }
    return j;
  };
  if (clean(env.RAZORPAY_MODE).toLowerCase() === 'qr') {
    const j = await post('https://api.razorpay.com/v1/payments/qr_codes', { type: 'upi_qr', name: 'therajesh.shop', usage: 'single_use', fixed_amount: true, payment_amount: paise, description: desc, close_by: Math.floor(Date.now() / 1000) + 55 * 60, notes });
    return { kind: 'qr', ref: j.id, url: j.image_url, qrImage: j.image_url };
  }
  const validContact = rzpContact(o.wa_number, o.wa_chat) || rzpContact(o.wa_chat, o.wa_chat);
  const customer = { name: String(o.wa_name || '').trim().slice(0, 50) || 'Customer' };
  if (validContact) customer.contact = validContact;           // NEVER send contact:"" / null - Razorpay still length-checks it (8-14)
  else botLog(`ℹ️ No dialable phone for order ${o.id} (${String(o.wa_number || '').replace(/\D/g, '').length} digits) – UPI link created without customer.contact`);
  const body = { amount: paise, currency: 'INR', accept_partial: false, reference_id: o.id, description: desc, customer, notify: { sms: Boolean(validContact), email: false }, reminder_enable: false, expire_by: Math.floor(Date.now() / 1000) + 55 * 60, notes };
  const j = await post('https://api.razorpay.com/v1/payment_links', body);
  botLog(`✅ UPI payment link created for order ${o.id} (₹${o.amount})`);
  return { kind: 'link', ref: j.id, url: j.short_url };
}
async function razorpayCancel(env, o) {
  try {
    if (!o.pay_ref) return;
    const { id: keyId, secret } = rzpKeys(env); if (!keyId || !secret) return;
    const auth = 'Basic ' + btoa(keyId + ':' + secret);
    if (String(o.pay_ref).startsWith('plink_')) await fetch(`https://api.razorpay.com/v1/payment_links/${o.pay_ref}/cancel`, { method: 'POST', headers: { authorization: auth } });
    else if (String(o.pay_ref).startsWith('qr_')) await fetch(`https://api.razorpay.com/v1/payments/qr_codes/${o.pay_ref}/close`, { method: 'POST', headers: { authorization: auth } });
  } catch {}
}

// ---------- a payment was confirmed (webhook, polling or the website checkout) ----------
async function markPaid(env, id, info) {
  await ensureSchema(env);
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
  if (!o || o.pay_status === 'paid') return { ok: false, reason: o ? 'duplicate' : 'unknown' };
  if (info.paise !== undefined && Math.round(Number(o.amount) * 100) !== Math.round(Number(info.paise))) return { ok: false, reason: 'amount mismatch' };   // never accept a wrong amount
  if (!['pending', 'error', 'pay_choose', 'pay_wait', 'cash_wait', 'wa_wait'].includes(o.status)) return { ok: false, reason: 'status ' + o.status };
  const wa = o.source === 'whatsapp';
  const auto = await autoOn(env, true);
  const next = auto ? 'approved' : 'pending';   // paid online: print at once when Auto-Print is ON, otherwise wait for the counter
  const r = await env.DB.prepare("UPDATE orders SET pay_status='paid', pay_method='upi', pay_utr=?, paid_at=?, status=? WHERE id=? AND (pay_status IS NULL OR pay_status<>'paid')").bind(String(info.utr || '').slice(0, 40), Date.now(), next, id).run();
  if (!((r.meta && r.meta.changes) > 0)) return { ok: false, reason: 'duplicate' };
  if (next === 'approved') await ledgerAdd(env, id);
  if (wa && o.wa_number) await waSend(env, o.wa_number, o.wa_chat, waPaidText(o.amount, next === 'approved'));
  return { ok: true, status: next };
}
// Razorpay -> POST /api/razorpay/webhook (signature = HMAC-SHA256 of the raw body with the webhook secret)
async function razorpayWebhook(request, env) {
  const secret = clean(env.RAZORPAY_WEBHOOK_SECRET);
  if (!secret) return json({ error: 'RAZORPAY_WEBHOOK_SECRET is not set in Cloudflare' }, 500);
  const raw = new Uint8Array(await request.arrayBuffer());
  if (!sameSecret(request.headers.get('x-razorpay-signature'), await hmacHex(secret, raw))) return json({ error: 'Invalid signature' }, 401);
  let p; try { p = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: 'Bad JSON' }, 400); }
  const ev = String(p.event || ''), pl = p.payload || {};
  if (!['payment_link.paid', 'payment.captured', 'qr_code.credited', 'order.paid'].includes(ev)) return json({ received: true, ignored: true });
  const pay = (pl.payment && pl.payment.entity) || {}, link = (pl.payment_link && pl.payment_link.entity) || {}, qr = (pl.qr_code && pl.qr_code.entity) || {};
  const id = String((link.notes && link.notes.shop_order) || link.reference_id || (qr.notes && qr.notes.shop_order) || (pay.notes && pay.notes.shop_order) || '');
  if (!/^[A-Z0-9]+$/.test(id)) return json({ received: true, ignored: 'no order' });
  const paise = ev === 'payment_link.paid' ? Number(link.amount_paid || pay.amount) : Number(pay.amount);
  const r = await markPaid(env, id, { utr: pay.id || link.id || qr.id, paise: Number.isFinite(paise) && paise > 0 ? paise : undefined });
  return json({ received: true, ...r });
}
// Safety net when the webhook is not set up (or a delivery was lost): look at Razorpay ourselves, at most every 12 s
async function pollPayments(env) {
  const last = Number(await getSetting(env, 'pay_poll')) || 0;
  if (Date.now() - last < 12000) return;
  const { results } = await env.DB.prepare("SELECT * FROM orders WHERE status='pay_wait' AND pay_ref IS NOT NULL ORDER BY created_at DESC LIMIT 6").all();
  if (!results.length) return;
  await setSetting(env, 'pay_poll', Date.now());
  const { id: keyId, secret } = rzpKeys(env); if (!keyId || !secret) return;
  const h = { authorization: 'Basic ' + btoa(keyId + ':' + secret) };
  for (const o of results) {
    try {
      if (String(o.pay_ref).startsWith('plink_')) {
        const j = await (await fetch(`https://api.razorpay.com/v1/payment_links/${o.pay_ref}`, { headers: h })).json();
        if (j.status === 'paid') await markPaid(env, o.id, { utr: ((j.payments || [])[0] || {}).payment_id || o.pay_ref, paise: Number(j.amount_paid) || undefined });
      } else {
        const j = await (await fetch(`https://api.razorpay.com/v1/payments/qr_codes/${o.pay_ref}/payments`, { headers: h })).json();
        const p = (j.items || []).find((x) => ['captured', 'authorized'].includes(x.status));
        if (p) await markPaid(env, o.id, { utr: p.id, paise: Number(p.amount) });
      }
    } catch {}
  }
}

// ---------- the conversation ----------
async function waAfterMode(env, o, color, copies, flags, kind = 'doc') {   // mode chosen -> price -> ask UPI or cash
  const P = await getPrices(env), { pages } = await orderTotals(env, o.id);
  const passport = kind === 'passport';
  copies = Math.min(Math.max(parseInt(copies) || 1, 1), passport ? PASSPORT_MAX : 100);
  // passport: priced per 4x6 sheet (8 photos fit one sheet); documents: pages x copies x rate
  const total = passport ? Math.round(Math.ceil(copies / PASSPORT_PER_SHEET) * P.passport4x6 * 100) / 100
    : Math.round(pages * copies * (color ? P.color : P.bw) * 100) / 100;
  const token = o.token || await nextWaToken(env);
  // copies + color + paper + kind are all stored on the order; /api/agent/jobs returns the whole row (copies, color, paper, opts.kind)
  await env.DB.prepare("UPDATE orders SET color=?, copies=?, amount=?, token=?, paper=?, status='pay_choose', opts=? WHERE id=? AND status IN ('wa_wait','pay_choose')")
    .bind(passport ? 1 : (color ? 1 : 0), copies, total, token, passport ? '4x6' : 'A4', JSON.stringify({ kind: passport ? 'passport' : 'doc', source: 'whatsapp' }), o.id).run();
  return waStep2Text(token, passport ? 1 : color, passport ? 1 : pages, copies, total, passport ? 'passport' : 'doc');
}
async function waCash(env, o) {
  await env.DB.prepare("UPDATE orders SET status='cash_wait', pay_method='cash' WHERE id=? AND status IN ('pay_choose','pay_wait')").bind(o.id).run();
  if (o.pay_ref) await razorpayCancel(env, o);
  return waCashText(o.token, o.amount);
}
async function waUpi(env, o) {
  let p;
  try { p = await razorpayCreate(env, o); } catch (e) { p = null; var err = e.message; }
  if (!p) return [`⚠️ অনলাইন পেমেন্ট এখন চালু নেই${err ? ' (' + err.slice(0, 80) + ')' : ''}। দয়া করে *2* লিখে কাউন্টারে ক্যাশ দিন।\n_Online payment is unavailable right now — reply 2 to pay cash at the counter._`];
  await env.DB.prepare("UPDATE orders SET status='pay_wait', pay_method='upi', pay_ref=?, pay_url=? WHERE id=? AND status='pay_choose'").bind(p.ref, p.url, o.id).run();
  return [{ text: waPayText(o.amount, p.url), card: { shop: 'therajesh.shop', token: o.token, amount: Number(o.amount), url: p.url, qrImage: p.qrImage || '' } }];
}

// text-only message while an order is open
async function waHandleReply(env, o, text, flags) {
  const t = String(text || '').trim().toLowerCase();
  const cancel = /^(0|cancel|stop|বাতিল)$/.test(t);
  if (cancel) {
    if (o.pay_ref) await razorpayCancel(env, o);
    await env.DB.prepare("UPDATE orders SET status='rejected', name='', phone='', wa_number='', wa_chat='' WHERE id=? AND status IN ('wa_wait','pay_choose','pay_wait','cash_wait')").bind(o.id).run();
    await purgeFiles(env, o.id); await env.DB.prepare('DELETE FROM files WHERE order_id=?').bind(o.id).run();
    return ['❌ বাতিল হয়েছে, ফাইল মুছে ফেলা হয়েছে।\n_Cancelled — your file was deleted._'];
  }
  if (o.status === 'wa_wait') {
    const ch = parseChoice(text);
    if (ch.opt === 1 || ch.opt === 2) return [await waAfterMode(env, o, ch.opt === 2, ch.copies || o.copies || 1, flags)];
    if (ch.opt === 3) {      // passport photos: needs an image; the PC agent removes the background and lays out the 4x6 sheet(s)
      const f = await env.DB.prepare('SELECT name FROM files WHERE order_id=? ORDER BY id LIMIT 1').bind(o.id).first();
      if (!f || !['jpg', 'jpeg', 'png', 'webp'].includes(ext(f.name || ''))) return ['📷 পাসপোর্ট ফটোর জন্য একটি পরিষ্কার *ছবি (JPG/PNG)* পাঠান, তারপর আবার *3* লিখুন।\n_Passport photos need a clear JPG/PNG photo — send it, then reply 3 again._'];
      return [await waAfterMode(env, o, true, ch.copies || (o.copies > 1 ? o.copies : PASSPORT_DEFAULT), flags, 'passport')];
    }
    return ['🙏 অনুগ্রহ করে *1* (সাদাকালো), *2* (রঙিন) বা *3* (পাসপোর্ট ফটো) লিখে রিপ্লাই দিন। উদাহরণ: `2x5`\n_Please reply 1 for B&W, 2 for Color or 3 for Passport photos (0 to cancel)._'];
  }
  if (o.status === 'pay_choose') {
    const upi = /^(1|upi|online|qr)$/.test(t), cash = /^(2|cash|counter|নগদ|ক্যাশ)$/.test(t);
    if (upi) return await waUpi(env, o);
    if (cash) return [await waCash(env, o)];
    return ['🙏 অনুগ্রহ করে *1* (Online UPI) বা *2* (Cash) লিখে রিপ্লাই দিন।\n_Please reply 1 for UPI or 2 for Cash._'];
  }
  if (o.status === 'pay_wait') {
    if (/^(2|cash|counter|নগদ|ক্যাশ)$/.test(t)) return [await waCash(env, o)];
    return [`⏳ *টোকেন #${o.token}:* পেমেন্টের অপেক্ষায় আছি।\n🔗 ${o.pay_url || ''}\n_Waiting for your UPI payment of ${rupee(o.amount)}. Reply 2 to pay cash instead, 0 to cancel._`];
  }
  return [`💵 *টোকেন #${o.token}:* কাউন্টারে এসে *${rupee(o.amount)}* দিন — তারপর প্রিন্ট বের হবে।\n_Token #${o.token}: please pay ${rupee(o.amount)} cash at the counter. Reply 0 to cancel._`];
}

async function waIncoming2(env, m) {
  await ensureSchema(env);
  const number = String(m.from || '').replace(/\D/g, '').slice(0, 15);
  if (!number) return [];
  const chat = String(m.chat || '').slice(0, 80), name = String(m.name || '').slice(0, 60);
  const text = String(m.text || '').trim().slice(0, 500);
  const now = Date.now(), flags = await getFlags(env), P = await getPrices(env);
  const files = Array.isArray(m.files) ? m.files : [];
  await env.DB.prepare('DELETE FROM wa_hits WHERE ts<?').bind(now - 2 * 3600000).run();
  const active = await env.DB.prepare(`SELECT * FROM orders WHERE source='whatsapp' AND wa_number=? AND status IN ('wa_wait','pay_choose','pay_wait','cash_wait') AND created_at>? ORDER BY created_at DESC LIMIT 1`).bind(number, now - 100 * 60000).first();

  if (!files.length) {
    if (active) return await waHandleReply(env, active, text, flags);
    const seen = await env.DB.prepare("SELECT 1 AS x FROM wa_hits WHERE number=? AND kind='welcome' AND ts>? LIMIT 1").bind(number, now - 30 * 60000).first();
    if (seen) return [];
    await env.DB.prepare("INSERT INTO wa_hits (number, ts, kind) VALUES (?,?,'welcome')").bind(number, now).run();
    return [WA_WELCOME];
  }

  // ---- file(s) arrived ----
  const limit = Number(env.WA_MAX_PER_HOUR) || 10, replies = [];
  const hits = await env.DB.prepare("SELECT COUNT(*) AS n FROM wa_hits WHERE number=? AND kind='file' AND ts>?").bind(number, now - 3600000).first();
  if (Number(hits.n) >= limit) return ['⏳ একসাথে অনেক ফাইল পাঠানো হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।\n_Too many files in a short time — please try again later._'];
  await env.DB.prepare("INSERT INTO wa_hits (number, ts, kind) VALUES (?,?,'file')").bind(number, now).run();
  const ok = [], bad = [];
  for (const f of files) {
    if (!ALLOWED.includes(ext(f.name || ''))) bad.push(f.name || 'file');
    else if (!f.bytes || !f.bytes.byteLength || f.bytes.byteLength > MAX_FILE_BYTES) bad.push((f.name || 'file') + ' (25 MB+)');
    else ok.push(f);
  }
  if (bad.length) replies.push(`⚠️ এই ফাইল নেওয়া যায়নি / not accepted: ${bad.join(', ')}\nসাপোর্টেড: PDF, JPG, PNG, Word, Excel, PowerPoint (২৫ MB পর্যন্ত)`);
  if (!ok.length) return replies;

  const open = active && active.status === 'wa_wait' ? active : null;   // more files before choosing B&W/Color join the same order
  let id, have = 0;
  if (open) { id = open.id; have = (await orderTotals(env, id)).n; }
  if (have + ok.length > MAX_FILES) return replies.concat([`⚠️ একসাথে সর্বোচ্চ ${MAX_FILES}টি ফাইল। / Max ${MAX_FILES} files per order.`]);
  if (!open) {
    id = newId();
    await env.DB.prepare("INSERT INTO orders (id,name,phone,color,copies,amount,status,created_at,paper,opts,source,wa_number,wa_name,wa_chat) VALUES (?,?,?,0,1,0,'wa_wait',?,'A4',?,'whatsapp',?,?,?)")
      .bind(id, name, number, now, JSON.stringify({ kind: 'doc', source: 'whatsapp' }), number, name, chat).run();
  } else if (chat) await env.DB.prepare('UPDATE orders SET wa_chat=? WHERE id=?').bind(chat, id).run();
  let i = have;
  for (const f of ok) {
    const pages = Math.min(Math.max(parseInt(f.pages) || (ext(f.name) === 'pdf' ? pdfPages(f.bytes) : 1), 1), 2000);
    const key = `${id}/${i++}-${safeName(f.name)}`;
    await env.FILES.put(key, f.bytes, { expirationTtl: FILE_TTL, metadata: { type: f.mime || 'application/octet-stream' } });
    await env.DB.prepare('INSERT INTO files (order_id,name,r2_key,pages) VALUES (?,?,?,?)').bind(id, String(f.name).slice(0, 120), key, pages).run();
  }
  const rows = (await env.DB.prepare('SELECT name, pages FROM files WHERE order_id=? ORDER BY id').bind(id).all()).results;
  const pages = rows.reduce((s, r) => s + Number(r.pages || 0), 0) || 1;
  const pc = parsePrintCaption(text);
  const cap = /^\s*([12])\s*(?:x|×|\*)\s*(\d{1,3})\s*$/i.exec(String(text).normalize('NFKC'));               // caption "2x3" style
  const mode = cap ? (cap[1] === '2' ? 'color' : 'bw') : (pc.mode || (flags.wabot === 'instant' ? 'bw' : null));
  const copies = cap ? Math.min(Math.max(parseInt(cap[2]), 1), 100) : pc.copies;
  const fresh = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
  if (mode) replies.push(await waAfterMode(env, fresh, mode === 'color', copies, flags));
  else {
    if (pc.onlyNumber && pc.copies > 1) await env.DB.prepare('UPDATE orders SET copies=? WHERE id=?').bind(pc.copies, id).run();
    replies.push(open ? `➕ ফাইল যোগ হয়েছে (মোট ${pages} Pages)। এবার *1* (সাদাকালো), *2* (রঙিন) বা *3* (পাসপোর্ট ফটো) লিখুন।\n_File added (total ${pages} pages). Reply 1 for B&W, 2 for Color or 3 for Passport._` : waStep1Text(rows, pages, P, env));
  }
  return replies;
}

// ---------- counter actions: cash received, manual upload, stats ----------
async function adminCashApprove(env, id) {
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
  if (!o) return json({ error: 'Order not found' }, 404);
  if (!['cash_wait', 'pay_wait', 'pay_choose', 'wa_wait', 'pending', 'error'].includes(o.status)) return json({ error: 'This order is already ' + o.status }, 409);
  if (o.status === 'wa_wait') {   // customer never chose a mode: print B&W for the copies set so far
    const P = await getPrices(env), { pages } = await orderTotals(env, id), copies = o.copies || 1;
    await env.DB.prepare('UPDATE orders SET amount=?, token=? WHERE id=?').bind(Math.round(pages * copies * P.bw * 100) / 100, o.token || await nextWaToken(env), id).run();
  }
  if (o.status === 'pay_wait') await razorpayCancel(env, o);
  const r = await env.DB.prepare("UPDATE orders SET status='approved', pay_method=CASE WHEN pay_status='paid' THEN pay_method ELSE 'cash' END, pay_status=CASE WHEN pay_status='paid' THEN pay_status ELSE 'cash_received' END, paid_at=? WHERE id=? AND status IN ('cash_wait','pay_wait','pay_choose','wa_wait','pending','error')").bind(Date.now(), id).run();
  if ((r.meta && r.meta.changes) > 0) {
    await ledgerAdd(env, id);
    if (o.source === 'whatsapp' && o.wa_number) await waSend(env, o.wa_number, o.wa_chat, WA_CASH_OK);
  }
  return json({ ok: true });
}
// ➕ Manual upload at the counter: files + options -> printed straight away (or held for crop/preview)
async function adminManualUpload(request, env) {
  await ensureSchema(env);
  const form = await request.formData();
  let meta; try { meta = JSON.parse(form.get('meta') || '{}'); } catch { return json({ error: 'Bad request' }, 400); }
  const files = form.getAll('files').filter((f) => typeof f !== 'string');
  if (!files.length) return json({ error: 'Choose at least one file' }, 400);
  if (files.length > MAX_FILES) return json({ error: `Max ${MAX_FILES} files` }, 400);
  for (const f of files) {
    if (!ALLOWED.includes(ext(f.name))) return json({ error: `File type not allowed: ${f.name}` }, 400);
    if (f.size > MAX_FILE_BYTES) return json({ error: `${f.name} is larger than 25 MB` }, 400);
  }
  const paper = PAPERS.includes(meta.paper) ? meta.paper : 'A4';
  const color = (meta.color || paper === '4x6') ? 1 : 0;
  const copies = Math.min(Math.max(parseInt(meta.copies) || 1, 1), 100);
  const payMethod = ['cash', 'upi', 'free'].includes(meta.pay) ? meta.pay : 'cash';
  const id = newId(), now = Date.now(), pagesList = Array.isArray(meta.pages) ? meta.pages : [];
  let total = 0; const rows = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i], buf = await f.arrayBuffer();
    const pages = Math.min(Math.max(parseInt(pagesList[i]) || (ext(f.name) === 'pdf' ? pdfPages(buf) : 1), 1), 2000);
    total += pages;
    const key = `${id}/${i}-${safeName(f.name)}`;
    await env.FILES.put(key, buf, { expirationTtl: FILE_TTL, metadata: { type: f.type || 'application/octet-stream' } });
    rows.push({ name: f.name.slice(0, 120), key, pages });
  }
  const P = await getPrices(env);
  let amount = paper === '4x6' ? total * copies * P.photo4x6 : total * copies * (color ? P.color : P.bw) * (paper === 'A3' ? P.a3 : 1);
  if (meta.amount !== undefined && meta.amount !== '' && Number.isFinite(Number(meta.amount)) && Number(meta.amount) >= 0) amount = Number(meta.amount);
  if (payMethod === 'free') amount = 0;
  amount = Math.round(amount * 100) / 100;
  const status = meta.hold ? 'pending' : 'approved';
  await env.DB.batch([
    env.DB.prepare("INSERT INTO orders (id,name,phone,color,copies,amount,status,created_at,paper,opts,source,pay_method,pay_status,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,'counter',?,?,?)")
      .bind(id, String(meta.name || 'Counter customer').slice(0, 60), String(meta.phone || '').slice(0, 15), color, copies, amount, status, now, paper,
        JSON.stringify({ kind: 'doc', source: 'counter', info: 'Added at the counter' }), payMethod, payMethod === 'upi' ? 'paid' : payMethod === 'cash' ? 'cash_received' : 'free', now),
    ...rows.map((r) => env.DB.prepare('INSERT INTO files (order_id,name,r2_key,pages) VALUES (?,?,?,?)').bind(id, r.name, r.key, r.pages)),
  ]);
  if (status === 'approved') await ledgerAdd(env, id);
  return json({ ok: true, id, amount, status });
}
// today's collections for the counter dashboard (India time)
async function adminStats(env) {
  await ensureSchema(env);
  const IST = 19800000, day = 86400000, start = Math.floor((Date.now() + IST) / day) * day - IST;
  const row = async (m) => (await env.DB.prepare('SELECT COALESCE(SUM(amount),0) AS a, COUNT(*) AS n FROM ledger WHERE ts>=? AND pay_method=?').bind(start, m).first()) || { a: 0, n: 0 };
  const upi = await row('upi'), cash = await row('cash');
  const t = (await env.DB.prepare('SELECT COALESCE(SUM(pages*copies),0) AS p, COUNT(*) AS n FROM ledger WHERE ts>=?').bind(start).first()) || { p: 0, n: 0 };
  return json({ upi: { amount: Number(upi.a), orders: Number(upi.n) }, cash: { amount: Number(cash.a), orders: Number(cash.n) }, pages: Number(t.p), orders: Number(t.n) });
}

// Cloud API replies: plain text, or the payment QR as an image (the PC bridge draws the branded card itself)
async function waCloudReply(env, to, r) {
  if (typeof r === 'string') return waCloudSend(env, to, r);
  const link = r.card && (r.card.qrImage || ('https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&data=' + encodeURIComponent(r.card.url)));
  if (link) {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${clean(env.WA_PHONE_ID)}/messages`, { method: 'POST', headers: { authorization: 'Bearer ' + clean(env.WA_TOKEN), 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'image', image: { link, caption: String(r.text).slice(0, 1000) } }) });
      if (res.ok) return;
    } catch {}
  }
  return waCloudSend(env, to, r.text);
}
