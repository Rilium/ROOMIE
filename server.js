const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const Stripe = require('stripe');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'roomie-data') : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'roomie-db.json');
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
const ALLOW_LOCAL_DB = !process.env.VERCEL && process.env.NODE_ENV !== 'production';
const IS_PRODUCTION_RUNTIME = process.env.VERCEL || process.env.NODE_ENV === 'production';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const SESSION_COOKIE = 'roomie.auth';
const SESSION_MAX_AGE = 1000 * 60 * 60 * 12;
let neonSql = null;
let postgresReady = false;

app.set('trust proxy', 1);

function defaultConfig() {
  return {
    hourlyPrice: 12,
    dayPrice: 60,
    guestPassPrice: 2,
    maxPeople: 8,
    lockboxCode: '4729'
  };
}

function defaultAddons() {
  return [
    { id:'dazn', category:'featured', brand:'DAZN', name:'DAZN Partita', description:'Champions League · 21:45. Sblocca la partita nella tua sessione.', price:5, status:'active', soldToday:3 },
    { id:'cinema', category:'featured', brand:'NETFLIX', name:'Cinema Mode', description:'Setup audio ottimizzato + Netflix/Prime in fullscreen 75"', price:3, status:'active', soldToday:2 },
    { id:'horror', category:'modes', brand:'ROOMIE', name:'Mood Horror', description:'Luci rosse, soundtrack horror, atmosfera da brivido', price:4, status:'active', soldToday:0 },
    { id:'gaming-pro', category:'modes', brand:'PS5', name:'Gaming Pro Setup', description:'Monitor 240Hz aggiuntivo, headset premium, poggiapolsi', price:8, status:'active', soldToday:1 },
    { id:'neon-party', category:'modes', brand:'SPOTIFY', name:'Neon Party', description:'Luci RGB animate, music mode, vibe da club', price:5, status:'active', soldToday:0 },
    { id:'pizza', category:'snacks', brand:'PARTNER', name:'Pizza Margherita', description:'Da Marco Pizzeria · Forno a legna', price:9, status:'active', soldToday:2 },
    { id:'beer', category:'snacks', brand:'LOCAL', name:'Birra Artigianale x4', description:'IPA locale · Birrificio Torinese', price:12, status:'active', soldToday:1 },
    { id:'snack', category:'snacks', brand:'MOVIE', name:'Snack Box', description:'Patatine, popcorn, nachos · Mix 5 pezzi', price:7, status:'active', soldToday:4 }
  ];
}

function createDefaultDb() {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: 'usr_admin',
        username: 'admin',
        name: 'System Admin',
        role: 'admin',
        chips: 999,
        passwordHash: bcrypt.hashSync('admin', 10),
        createdAt: now
      },
      {
        id: 'usr_marco',
        username: 'marco',
        name: 'Marco B.',
        role: 'user',
        chips: 120,
        passwordHash: bcrypt.hashSync('roomie', 10),
        createdAt: now
      }
    ],
    bookings: [
      {
        id: 'bk_demo_1',
        userId: 'usr_marco',
        room: 'Via Terni',
        date: '2026-06-15',
        start: '20:00',
        end: '22:00',
        people: 3,
        totalChips: 24,
        status: 'confirmed',
        createdAt: now
      }
    ],
    auditLog: [],
    config: defaultConfig(),
    addons: defaultAddons(),
    addonOrders: [],
    blockedSlots: []
  };
}

function seedDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) return;
  fs.writeFileSync(DB_FILE, JSON.stringify(createDefaultDb(), null, 2));
}

async function getSql() {
  if (!DATABASE_URL) return null;
  if (!neonSql) {
    const { neon } = await import('@neondatabase/serverless');
    neonSql = neon(DATABASE_URL);
  }
  return neonSql;
}

async function ensurePostgresDb() {
  const sql = await getSql();
  if (!sql || postgresReady) return sql;
  await sql`CREATE TABLE IF NOT EXISTS roomie_state (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const initial = JSON.stringify(createDefaultDb());
  await sql`INSERT INTO roomie_state (id, data)
    VALUES ('main', CAST(${initial} AS jsonb))
    ON CONFLICT (id) DO NOTHING`;
  postgresReady = true;
  return sql;
}

function normalizeDb(db) {
  let changed = false;
  if (!db.config) { db.config = defaultConfig(); changed = true; }
  if (!Array.isArray(db.addons)) { db.addons = defaultAddons(); changed = true; }
  if (!Array.isArray(db.addonOrders)) { db.addonOrders = []; changed = true; }
  if (!Array.isArray(db.blockedSlots)) { db.blockedSlots = []; changed = true; }
  if (!Array.isArray(db.stripeSessions)) { db.stripeSessions = []; changed = true; }
  if (applyAdminBootstrap(db)) changed = true;
  return { db, changed };
}

function applyAdminBootstrap(db) {
  const password = process.env.ADMIN_PASSWORD || '';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';
  if (!password && !passwordHash) return false;
  const username = normalizeUsername(process.env.ADMIN_USERNAME || 'admin');
  const name = String(process.env.ADMIN_NAME || 'ROOMIE Admin').trim();
  let changed = false;
  let admin = db.users.find(u => u.role === 'admin') || db.users.find(u => normalizeUsername(u.username) === username);
  if (!admin) {
    admin = {
      id: 'usr_admin',
      username,
      name,
      role: 'admin',
      chips: 999,
      passwordHash: passwordHash || bcrypt.hashSync(password, 10),
      createdAt: new Date().toISOString()
    };
    db.users.push(admin);
    return true;
  }
  const nextHash = passwordHash || bcrypt.hashSync(password, 10);
  if (normalizeUsername(admin.username) !== username) { admin.username = username; changed = true; }
  if (admin.name !== name) { admin.name = name; changed = true; }
  if (admin.role !== 'admin') { admin.role = 'admin'; changed = true; }
  if (admin.suspended) { admin.suspended = false; changed = true; }
  if (!admin.passwordHash || !bcrypt.compareSync(password || crypto.randomBytes(18).toString('hex'), admin.passwordHash)) {
    if (admin.passwordHash !== nextHash) { admin.passwordHash = nextHash; changed = true; }
  }
  return changed;
}

async function readDb() {
  if (DATABASE_URL) {
    const sql = await ensurePostgresDb();
    const rows = await sql`SELECT data FROM roomie_state WHERE id = 'main' LIMIT 1`;
    const state = rows[0]?.data || createDefaultDb();
    const { db, changed } = normalizeDb(state);
    if (changed) await writeDb(db);
    return db;
  }
  if (!ALLOW_LOCAL_DB) {
    throw new Error('STORAGE_NOT_CONFIGURED');
  }
  seedDb();
  const { db, changed } = normalizeDb(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  if (changed) await writeDb(db);
  return db;
}

async function writeDb(db) {
  if (DATABASE_URL) {
    const sql = await ensurePostgresDb();
    const data = JSON.stringify(db);
    await sql`INSERT INTO roomie_state (id, data, updated_at)
      VALUES ('main', CAST(${data} AS jsonb), NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
    return;
  }
  if (!ALLOW_LOCAL_DB) {
    throw new Error('STORAGE_NOT_CONFIGURED');
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    name: user.name,
    role: user.role,
    chips: user.chips,
    suspended: Boolean(user.suspended)
  };
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function appBaseUrl(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return (process.env.APP_URL || `${proto}://${req.get('host')}`).replace(/\/$/, '');
}

function redirectWithAuthError(req, res, code = 'SOCIAL_NOT_CONFIGURED') {
  res.redirect(`${appBaseUrl(req)}/?auth_error=${encodeURIComponent(code)}`);
}

function googleTokenErrorCode(token = {}) {
  const error = String(token.error || '');
  const description = String(token.error_description || '').toLowerCase();
  if (error === 'invalid_client' || description.includes('client secret')) return 'GOOGLE_SECRET_INVALID';
  if (error === 'invalid_grant' || description.includes('bad request')) return 'GOOGLE_CODE_EXPIRED';
  if (description.includes('redirect_uri')) return 'GOOGLE_REDIRECT_MISMATCH';
  return 'GOOGLE_TOKEN_ERROR';
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return {};
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (_err) {
    return {};
  }
}

function googleCallbackBridge() {
  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ROOMIE Google Login</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#050505;color:#fff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;overflow:hidden}
    body:before{content:'';position:fixed;inset:0;background:radial-gradient(circle at 50% 42%,rgba(200,255,0,.18),transparent 34%),linear-gradient(180deg,rgba(0,0,0,.96),rgba(6,8,3,.98))}
    .wrap{position:relative;text-align:center;padding:28px;display:flex;flex-direction:column;align-items:center;gap:18px}
    .brand{font-family:Impact,Arial Black,sans-serif;font-size:clamp(54px,14vw,104px);line-height:.82;letter-spacing:.08em;color:#c8ff00;text-shadow:0 0 22px rgba(200,255,0,.72),0 0 70px rgba(200,255,0,.32)}
    .chip{width:132px;height:132px;border-radius:50%;position:relative;background:radial-gradient(circle at 34% 28%,#fff 0 7%,transparent 8%),radial-gradient(circle at 50% 50%,#151515 0 33%,#c8ff00 34% 44%,#111 45% 58%,#c8ff00 59% 72%,#050505 73% 100%);border:1px solid rgba(255,255,255,.24);box-shadow:inset 0 1px 3px rgba(255,255,255,.35),inset 0 -6px 12px rgba(0,0,0,.75),0 0 44px rgba(200,255,0,.56);animation:spin .72s cubic-bezier(.22,1,.36,1) infinite}
    .chip:before{content:'R';position:absolute;inset:24%;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#f7ffd6,#a6d800);color:#111;font-size:44px;font-weight:900}
    .copy{font-size:18px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.sub{max-width:310px;color:rgba(255,255,255,.58);line-height:1.45;font-size:14px;font-weight:700}
    @keyframes spin{from{transform:rotateY(0deg) rotateZ(0deg)}to{transform:rotateY(360deg) rotateZ(12deg)}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">ROOMIE</div>
    <div class="chip" aria-hidden="true"></div>
    <div class="copy">ACCESSO GOOGLE</div>
    <div class="sub">Confermiamo il profilo e prepariamo saldo chips, dashboard e prossima sessione.</div>
  </div>
  <script>
  (async function(){
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const body = { id_token: hash.get('id_token'), state: hash.get('state') };
    try {
      const res = await fetch('/api/auth/google/token', {
        method:'POST',
        credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok || !data.redirect) throw new Error(data.error || 'SOCIAL_LOGIN_ERROR');
      location.replace(data.redirect);
    } catch (err) {
      location.replace('/?auth_error=' + encodeURIComponent(err.message || 'SOCIAL_LOGIN_ERROR'));
    }
  })();
  </script>
</body>
</html>`;
}

async function upsertGoogleUserFromProfile(profile) {
  const email = normalizeEmail(profile.email);
  if (!email) return null;
  const db = await readDb();
  let user = db.users.find(u => normalizeEmail(u.email) === email || (u.provider === 'google' && u.providerId === String(profile.sub || '')));
  if (!user) {
    user = {
      id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex'),
      username: uniqueUsername(db, safeUsernameFromEmail(email, 'google')),
      email,
      name: String(profile.name || email.split('@')[0]).trim(),
      role: 'user',
      chips: 24,
      provider: 'google',
      providerId: String(profile.sub || ''),
      avatar: profile.picture || '',
      passwordHash: bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10),
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    await writeDb(db);
    await logEvent('social_register', user.id, { provider: 'google', email });
  } else {
    user.provider = user.provider || 'google';
    user.providerId = user.providerId || String(profile.sub || '');
    user.avatar = user.avatar || profile.picture || '';
    user.name = user.name || String(profile.name || email.split('@')[0]).trim();
    await writeDb(db);
  }
  return user;
}

function parseCookies(header = '') {
  return String(header || '').split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index < 0) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function sessionSecret() {
  return process.env.SESSION_SECRET || 'roomie-local-dev-secret-change-me';
}

function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyPayload(token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return {};
  const expected = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return {};
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Number(payload.exp) < Date.now()) return {};
    return payload;
  } catch (_err) {
    return {};
  }
}

function sessionCookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge
  };
}

function attachSession(req, res, next) {
  const payload = verifyPayload(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
  req.session = {
    userId: payload.userId || null,
    oauthState: payload.oauthState || null,
    cookie: { maxAge: SESSION_MAX_AGE },
    destroy(callback) {
      this.userId = null;
      this.oauthState = null;
      res.clearCookie(SESSION_COOKIE, sessionCookieOptions(0));
      if (callback) callback();
    }
  };
  res.commitSession = () => {
    const data = {};
    if (req.session.userId) data.userId = req.session.userId;
    if (req.session.oauthState) data.oauthState = req.session.oauthState;
    if (!data.userId && !data.oauthState) {
      res.clearCookie(SESSION_COOKIE, sessionCookieOptions(0));
      return;
    }
    const maxAge = Number(req.session.cookie?.maxAge || SESSION_MAX_AGE);
    data.exp = Date.now() + maxAge;
    res.cookie(SESSION_COOKIE, signPayload(data), sessionCookieOptions(maxAge));
  };
  next();
}

function safeUsernameFromEmail(email, fallback = 'roomie') {
  const base = normalizeUsername(String(email || fallback).split('@')[0]).replace(/[^a-z0-9_]/g, '_').slice(0, 16) || 'roomie';
  return base.length >= 3 ? base : `${base}_user`;
}

function uniqueUsername(db, seed) {
  let username = seed;
  let suffix = 1;
  while (db.users.some(u => normalizeUsername(u.username) === username)) {
    const trimmed = seed.slice(0, Math.max(3, 20 - String(suffix).length - 1));
    username = `${trimmed}_${suffix}`;
    suffix += 1;
  }
  return username;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  next();
}

async function requireAdmin(req, res, next) {
  const db = await readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'ADMIN_REQUIRED' });
  req.user = user;
  next();
}

async function logEvent(type, userId, details = {}) {
  const db = await readDb();
  db.auditLog.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex'),
    type,
    userId,
    details,
    createdAt: new Date().toISOString()
  });
  db.auditLog = db.auditLog.slice(0, 100);
  await writeDb(db);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  const toMinutes = value => {
    const [hh, mm] = String(value).split(':').map(Number);
    return (Number(hh || 0) * 60) + Number(mm || 0);
  };
  const expand = (start, end) => {
    const s = toMinutes(start);
    let e = toMinutes(end);
    if (e <= s) e += 1440;
    return [[s, e], [s + 1440, e + 1440]];
  };
  const a = expand(aStart, aEnd);
  const b = expand(bStart, bEnd);
  return a.some(([as, ae]) => b.some(([bs, be]) => as < be && ae > bs));
}

function addHoursToTime(time, hours) {
  const [hh, mm] = String(time || '00:00').split(':').map(Number);
  const totalMinutes = (Number(hh || 0) * 60) + Number(mm || 0) + (Number(hours || 0) * 60);
  const next = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

function makeCode(length = 4) {
  const max = 10 ** length;
  return String(crypto.randomInt(0, max)).padStart(length, '0');
}

function activeStatuses() {
  return ['confirmed', 'pending'];
}

function hasBookingConflict(db, { date, start, end, ignoreId = null }) {
  if (!date || !start || !end) return false;
  const blocked = (db.blockedSlots || []).some(slot => slot.date === date && overlaps(start, end, slot.start, slot.end));
  const booked = (db.bookings || []).some(booking => {
    if (ignoreId && booking.id === ignoreId) return false;
    if (!activeStatuses().includes(booking.status)) return false;
    return booking.date === date && overlaps(start, end, booking.start, booking.end);
  });
  return blocked || booked;
}

function ensureBookingAccess(booking, config = defaultConfig()) {
  if (!booking.lockboxCode) booking.lockboxCode = config.lockboxCode || makeCode(4);
  if (!booking.doorCode) booking.doorCode = makeCode(4);
  if (!booking.accessValidUntil) booking.accessValidUntil = booking.end || '23:00';
  return booking;
}

async function creditStripeCheckoutSession(session) {
  if (!session || session.payment_status !== 'paid') return { credited: false, reason: 'NOT_PAID' };
  const sessionId = session.id;
  const userId = session.metadata?.userId;
  const amount = Number(session.metadata?.chips || 0);
  if (!sessionId || !userId || !Number.isInteger(amount) || amount <= 0 || amount > 500) {
    return { credited: false, reason: 'BAD_METADATA' };
  }
  const db = await readDb();
  if ((db.stripeSessions || []).some(item => item.id === sessionId)) {
    return { credited: false, reason: 'ALREADY_CREDITED' };
  }
  const user = db.users.find(u => u.id === userId);
  if (!user) return { credited: false, reason: 'USER_NOT_FOUND' };
  user.chips = Number(user.chips || 0) + amount;
  db.stripeSessions.unshift({
    id: sessionId,
    userId,
    amount,
    paymentIntent: session.payment_intent || '',
    createdAt: new Date().toISOString()
  });
  await writeDb(db);
  await logEvent('stripe_wallet_topup', user.id, { amount, sessionId });
  return { credited: true, user: publicUser(user), amount };
}

function serializeBooking(booking) {
  return {
    ...booking,
    lockboxCode: booking.lockboxCode || '',
    doorCode: booking.doorCode || '',
    accessValidUntil: booking.accessValidUntil || booking.end || ''
  };
}

function serializeAddon(addon) {
  return {
    id: addon.id,
    category: addon.category || 'featured',
    brand: addon.brand || 'ROOMIE',
    name: addon.name,
    description: addon.description || '',
    price: Number(addon.price || 0),
    status: addon.status || 'active',
    soldToday: Number(addon.soldToday || 0)
  };
}

function bookingStartDate(booking) {
  const date = booking?.date || '1970-01-01';
  const start = booking?.start || '00:00';
  const value = new Date(`${date}T${start}:00`);
  return Number.isNaN(value.getTime()) ? new Date(0) : value;
}

function buildDashboardSummary(user, db) {
  const now = new Date();
  const bookings = (db.bookings || [])
    .filter(b => b.userId === user.id)
    .map(b => serializeBooking(ensureBookingAccess(b, db.config)));
  const sorted = [...bookings].sort((a, b) => bookingStartDate(a) - bookingStartDate(b));
  const upcoming = sorted.filter(b => activeStatuses().includes(b.status) && bookingStartDate(b) >= now);
  const next = upcoming[0] || sorted.find(b => activeStatuses().includes(b.status)) || null;
  const completed = bookings.filter(b => ['confirmed', 'completed'].includes(b.status));
  const monthCount = completed.filter(b => {
    const d = bookingStartDate(b);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const totalSpent = bookings.reduce((sum, b) => sum + Number(b.totalChips || 0), 0);
  const toNeon = Math.max(0, 5 - monthCount);
  const favorite = completed.reduce((acc, b) => {
    const key = `${b.start || '20:00'}|${bookingStartDate(b).getDay()}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const favoriteKey = Object.entries(favorite).sort((a, b) => b[1] - a[1])[0]?.[0] || '20:00|5';
  const [favoriteStart, favoriteDay] = favoriteKey.split('|');
  const recommended = {
    dayIndex: Number(favoriteDay || 5),
    start: favoriteStart || '20:00',
    durationHours: 2,
    title: bookings.length ? 'Riprendi il tuo slot forte' : 'Prima sessione consigliata',
    copy: bookings.length
      ? 'Stesso ritmo del tuo gruppo, meno decisioni da prendere.'
      : 'Ranked Session da 2h: prezzo chiaro, esperienza completa, zero overthinking.'
  };
  const mission = next
    ? { title: 'Arriva senza attrito', copy: 'Codici, accesso guidato e addon sono pronti nella prossima sessione.', cta: 'APRI ACCESSO', page: 'confirm' }
    : user.chips >= Number(db.config?.hourlyPrice || 12)
      ? { title: 'Blocca la prima serata', copy: 'Hai già chips per partire. Scegli preset, ora e gruppo.', cta: 'PRENOTA ORA', page: 'room' }
      : { title: 'Carica la chip', copy: 'Ricarica il saldo e blocca il primo slot senza uscire dal flow.', cta: 'RICARICA', page: 'token' };
  const recommendedAddons = (db.addons || [])
    .filter(a => a.status === 'active')
    .sort((a, b) => Number(b.soldToday || 0) - Number(a.soldToday || 0))
    .slice(0, 3)
    .map(serializeAddon);
  return {
    user: publicUser(user),
    bookings,
    next,
    history: [...bookings].sort((a, b) => bookingStartDate(b) - bookingStartDate(a)).slice(0, 6),
    stats: {
      totalBookings: bookings.length,
      totalSpent,
      monthCount,
      toNeon,
      chips: Number(user.chips || 0)
    },
    mission,
    recommended,
    recommendedAddons
  };
}

if (ALLOW_LOCAL_DB && !DATABASE_URL) seedDb();

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send('Stripe webhook not configured');
  }
  if (!DATABASE_URL && !ALLOW_LOCAL_DB) {
    return res.status(503).send('Storage not configured');
  }
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (_err) {
    return res.status(400).send('Invalid Stripe signature');
  }
  if (event.type === 'checkout.session.completed') {
    try {
      await creditStripeCheckoutSession(event.data.object);
    } catch (_err) {
      return res.status(503).send('Storage not configured');
    }
  }
  res.json({ received: true });
});

app.use(express.json());
app.use(attachSession);

app.use('/api', (req, res, next) => {
  if (req.path === '/health/storage' || req.path === '/health/oauth') return next();
  if (!DATABASE_URL && !ALLOW_LOCAL_DB) {
    return res.status(503).json({
      error: 'STORAGE_NOT_CONFIGURED',
      message: 'Configura DATABASE_URL/Postgres su Vercel prima di usare dati reali.'
    });
  }
  next();
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password, remember } = req.body || {};
  const db = await readDb();
  const login = normalizeUsername(username);
  const user = db.users.find(u => u.username === login || normalizeEmail(u.email) === login);
  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'BAD_CREDENTIALS' });
  }
  if (IS_PRODUCTION_RUNTIME && user.role === 'admin' && String(password || '') === 'admin') {
    return res.status(403).json({ error: 'ADMIN_DEFAULT_PASSWORD_DISABLED' });
  }
  if (user.suspended) return res.status(403).json({ error: 'USER_SUSPENDED' });
  if (remember) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
  req.session.userId = user.id;
  res.commitSession();
  await logEvent('login', user.id, { username: user.username });
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/register', async (req, res) => {
  const db = await readDb();
  const username = normalizeUsername(req.body?.username);
  const email = normalizeEmail(req.body?.email);
  const name = String(req.body?.name || '').trim();
  const password = String(req.body?.password || '');
  const remember = Boolean(req.body?.remember);

  if (!name || name.length < 2) {
    return res.status(400).json({ error: 'BAD_NAME' });
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'BAD_USERNAME' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'BAD_EMAIL' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'WEAK_PASSWORD' });
  }
  if (db.users.some(u => normalizeUsername(u.username) === username)) {
    return res.status(409).json({ error: 'USERNAME_TAKEN' });
  }
  if (db.users.some(u => normalizeEmail(u.email) === email)) {
    return res.status(409).json({ error: 'EMAIL_TAKEN' });
  }

  const user = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex'),
    username,
    email,
    name,
    role: 'user',
    chips: 24,
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  await writeDb(db);
  if (remember) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
  req.session.userId = user.id;
  res.commitSession();
  await logEvent('register', user.id, { username, email });
  res.status(201).json({ user: publicUser(user) });
});

app.get('/api/auth/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return redirectWithAuthError(req, res, 'GOOGLE_NOT_CONFIGURED');
  }
  const state = crypto.randomBytes(18).toString('hex');
  req.session.oauthState = state;
  res.commitSession();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${appBaseUrl(req)}/api/auth/google/callback`,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: state,
    state,
    prompt: 'select_account'
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query || {};
    if (!code) {
      res.type('html').send(googleCallbackBridge());
      return;
    }
    if (!code || !state || state !== req.session.oauthState) {
      return redirectWithAuthError(req, res, 'SOCIAL_STATE_ERROR');
    }
    delete req.session.oauthState;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${appBaseUrl(req)}/api/auth/google/callback`,
        grant_type: 'authorization_code'
      })
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) {
      console.error('Google token exchange failed', {
        status: tokenRes.status,
        error: token.error,
        description: token.error_description,
        redirectUri: `${appBaseUrl(req)}/api/auth/google/callback`,
        hasClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
        hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET)
      });
      return redirectWithAuthError(req, res, googleTokenErrorCode(token));
    }
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const profile = await profileRes.json();
    const email = normalizeEmail(profile.email);
    if (!profileRes.ok || !email) {
      return redirectWithAuthError(req, res, 'GOOGLE_PROFILE_ERROR');
    }
    const user = await upsertGoogleUserFromProfile(profile);
    if (!user) return redirectWithAuthError(req, res, 'GOOGLE_PROFILE_ERROR');
    if (user.suspended) return redirectWithAuthError(req, res, 'USER_SUSPENDED');
    req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
    req.session.userId = user.id;
    res.commitSession();
    await logEvent('social_login', user.id, { provider: 'google', email });
    res.redirect(`${appBaseUrl(req)}/?page=${user.role === 'admin' ? 'admin' : 'dashboard'}&auth=social`);
  } catch (_err) {
    redirectWithAuthError(req, res, 'SOCIAL_LOGIN_ERROR');
  }
});

app.post('/api/auth/google/token', async (req, res) => {
  try {
    const idToken = String(req.body?.id_token || '');
    const state = String(req.body?.state || '');
    if (!idToken || !state || state !== req.session.oauthState) {
      return res.status(401).json({ error: 'SOCIAL_STATE_ERROR' });
    }
    const tokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    const tokenInfo = await tokenRes.json();
    const jwtPayload = decodeJwtPayload(idToken);
    const issuerOk = tokenInfo.iss === 'https://accounts.google.com' || tokenInfo.iss === 'accounts.google.com';
    if (!tokenRes.ok || tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID || !issuerOk) {
      console.error('Google id_token validation failed', {
        status: tokenRes.status,
        error: tokenInfo.error,
        audMatches: tokenInfo.aud === process.env.GOOGLE_CLIENT_ID,
        iss: tokenInfo.iss
      });
      return res.status(401).json({ error: 'GOOGLE_TOKEN_ERROR' });
    }
    if ((tokenInfo.nonce || jwtPayload.nonce) !== req.session.oauthState) {
      return res.status(401).json({ error: 'SOCIAL_STATE_ERROR' });
    }
    delete req.session.oauthState;
    const profile = {
      ...jwtPayload,
      ...tokenInfo,
      sub: tokenInfo.sub || jwtPayload.sub,
      email: tokenInfo.email || jwtPayload.email,
      name: tokenInfo.name || jwtPayload.name,
      picture: tokenInfo.picture || jwtPayload.picture
    };
    const user = await upsertGoogleUserFromProfile(profile);
    if (!user) return res.status(401).json({ error: 'GOOGLE_PROFILE_ERROR' });
    if (user.suspended) return res.status(403).json({ error: 'USER_SUSPENDED' });
    req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
    req.session.userId = user.id;
    res.commitSession();
    await logEvent('social_login', user.id, { provider: 'google', email: profile.email, mode: 'id_token' });
    res.json({ user: publicUser(user), redirect: `/?page=${user.role === 'admin' ? 'admin' : 'dashboard'}&auth=social` });
  } catch (_err) {
    res.status(500).json({ error: 'SOCIAL_LOGIN_ERROR' });
  }
});

app.get('/api/auth/apple', (req, res) => {
  redirectWithAuthError(req, res, 'APPLE_NOT_CONFIGURED');
});

app.get('/api/health/oauth', (_req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  res.json({
    google: {
      clientIdPresent: Boolean(googleClientId),
      clientIdLooksValid: /\.apps\.googleusercontent\.com$/.test(googleClientId),
      clientIdLength: googleClientId.length,
      clientSecretPresent: Boolean(googleClientSecret),
      clientSecretLooksValid: /^GOCSPX-/.test(googleClientSecret),
      clientSecretLength: googleClientSecret.length,
      flow: 'id_token',
      secretRequired: false,
      redirectUri: 'https://roomie.rilio.it/api/auth/google/callback'
    }
  });
});

app.get('/api/health/storage', async (_req, res) => {
  if (!DATABASE_URL && !ALLOW_LOCAL_DB) {
    return res.status(503).json({
      driver: 'none',
      persistent: false,
      configured: false,
      error: 'STORAGE_NOT_CONFIGURED'
    });
  }
  try {
    const db = await readDb();
    res.json({
      driver: DATABASE_URL ? 'postgres' : 'local-json',
      persistent: Boolean(DATABASE_URL),
      configured: Boolean(DATABASE_URL) || ALLOW_LOCAL_DB,
      users: db.users.length,
      bookings: db.bookings.length,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      driver: DATABASE_URL ? 'postgres' : 'local-json',
      persistent: Boolean(DATABASE_URL),
      error: 'STORAGE_UNAVAILABLE'
    });
  }
});

app.get('/api/health/payments', (_req, res) => {
  const secret = process.env.STRIPE_SECRET_KEY || '';
  const publishable = process.env.STRIPE_PUBLISHABLE_KEY || '';
  const webhook = process.env.STRIPE_WEBHOOK_SECRET || '';
  res.json({
    stripe: {
      secretConfigured: Boolean(secret),
      publishableConfigured: Boolean(publishable),
      webhookConfigured: Boolean(webhook),
      mode: secret.startsWith('sk_live_') ? 'live' : secret.startsWith('sk_test_') ? 'test' : 'unknown',
      checkoutReady: Boolean(secret),
      webhookReady: Boolean(secret && webhook),
      endpoint: 'https://roomie.rilio.it/api/stripe/webhook'
    }
  });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  req.session.destroy(() => {});
  await logEvent('logout', userId);
  res.clearCookie('roomie.sid');
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ user: null });
  const db = await readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ user: null });
  res.json({ user: publicUser(user) });
});

app.get('/api/app/config', async (_req, res) => {
  const db = await readDb();
  res.json({
    config: db.config,
    blockedSlots: db.blockedSlots || [],
    bookedSlots: (db.bookings || [])
      .filter(b => activeStatuses().includes(b.status))
      .map(b => ({ id: b.id, date: b.date, start: b.start, end: b.end, status: b.status }))
  });
});

app.get('/api/addons', async (_req, res) => {
  const db = await readDb();
  res.json({ addons: db.addons.filter(a => a.status !== 'deleted').map(serializeAddon) });
});

app.post('/api/addon-orders', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const booking = db.bookings.find(b => b.id === req.body?.bookingId && (b.userId === user.id || user.role === 'admin'));
  if (!booking || !activeStatuses().includes(booking.status)) {
    return res.status(400).json({ error: 'ACTIVE_BOOKING_REQUIRED' });
  }

  const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const orderItems = requestedItems.map(item => {
    const addon = db.addons.find(a => a.id === item.id && a.status === 'active');
    if (!addon) return null;
    const qty = Math.max(1, Math.min(10, Number(item.qty || 1)));
    return {
      id: addon.id,
      name: addon.name,
      brand: addon.brand || 'ROOMIE',
      price: Number(addon.price || 0),
      qty,
      total: Number(addon.price || 0) * qty
    };
  }).filter(Boolean);

  if (!orderItems.length) return res.status(400).json({ error: 'EMPTY_ORDER' });
  const totalChips = orderItems.reduce((sum, item) => sum + item.total, 0);
  if (user.chips < totalChips) {
    return res.status(402).json({ error: 'INSUFFICIENT_CHIPS', chips: user.chips, required: totalChips });
  }

  user.chips -= totalChips;
  orderItems.forEach(item => {
    const addon = db.addons.find(a => a.id === item.id);
    if (addon) addon.soldToday = Number(addon.soldToday || 0) + item.qty;
  });

  const order = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex'),
    userId: user.id,
    bookingId: booking.id,
    items: orderItems,
    totalChips,
    status: 'paid',
    createdAt: new Date().toISOString()
  };
  db.addonOrders.unshift(order);
  await writeDb(db);
  await logEvent('addon_order_paid', user.id, { orderId: order.id, totalChips });
  res.status(201).json({ order, user: publicUser(user) });
});

app.get('/api/bookings', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  const bookings = user.role === 'admin'
    ? db.bookings
    : db.bookings.filter(b => b.userId === user.id);
  bookings.forEach(b => ensureBookingAccess(b, db.config));
  await writeDb(db);
  res.json({ bookings: bookings.map(serializeBooking) });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const summary = buildDashboardSummary(user, db);
  await writeDb(db);
  res.json(summary);
});

app.post('/api/bookings', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex');
  const totalChips = Number(req.body.totalChips || 0);
  if (!Number.isFinite(totalChips) || totalChips <= 0) {
    return res.status(400).json({ error: 'BAD_TOTAL' });
  }
  const date = req.body.date;
  const start = req.body.start;
  const end = req.body.end;
  if (!date || !start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return res.status(400).json({ error: 'BAD_BOOKING_TIME' });
  }
  const people = Number(req.body.people || 1);
  if (!Number.isInteger(people) || people < 1 || people > Number(db.config?.maxPeople || 8)) {
    return res.status(400).json({ error: 'BAD_PEOPLE' });
  }
  if (hasBookingConflict(db, { date, start, end })) {
    return res.status(409).json({ error: 'SLOT_BLOCKED' });
  }
  if (user.chips < totalChips) {
    return res.status(402).json({ error: 'INSUFFICIENT_CHIPS', chips: user.chips, required: totalChips });
  }
  user.chips -= totalChips;
  const booking = {
    id,
    userId: req.session.userId,
    room: 'Via Terni',
    date,
    start,
    end,
    people,
    totalChips,
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };
  ensureBookingAccess(booking, db.config);
  db.bookings.unshift(booking);
  await writeDb(db);
  await logEvent('booking_created', req.session.userId, { bookingId: id, totalChips });
  res.status(201).json({ booking: serializeBooking(booking), user: publicUser(user) });
});

app.post('/api/bookings/:id/extend', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const booking = db.bookings.find(b => b.id === req.params.id && (b.userId === user.id || user.role === 'admin'));
  if (!booking) return res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
  if (!['confirmed', 'pending'].includes(booking.status)) return res.status(400).json({ error: 'BOOKING_NOT_ACTIVE' });

  const hours = Math.max(1, Math.min(4, Number(req.body?.hours || 1)));
  const price = Number(db.config?.hourlyPrice || defaultConfig().hourlyPrice) * hours;
  const newEnd = addHoursToTime(booking.end, hours);
  if (hasBookingConflict(db, { date: booking.date, start: booking.end, end: newEnd, ignoreId: booking.id })) return res.status(409).json({ error: 'SLOT_BLOCKED' });
  if (user.role !== 'admin' && user.chips < price) {
    return res.status(402).json({ error: 'INSUFFICIENT_CHIPS', chips: user.chips, required: price });
  }
  if (user.role !== 'admin') user.chips -= price;
  booking.end = newEnd;
  booking.accessValidUntil = newEnd;
  booking.totalChips = Number(booking.totalChips || 0) + price;
  await writeDb(db);
  await logEvent('booking_extended', user.id, { bookingId: booking.id, hours, price });
  res.json({ booking: serializeBooking(booking), user: publicUser(user), charged: user.role === 'admin' ? 0 : price });
});

app.post('/api/wallet/topup', requireAuth, async (req, res) => {
  const amount = Number(req.body.amount || 0);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 500) {
    return res.status(400).json({ error: 'BAD_AMOUNT' });
  }
  const db = await readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  user.chips += amount;
  await writeDb(db);
  await logEvent('wallet_topup', user.id, { amount });
  res.json({ user: publicUser(user), amount });
});

app.post('/api/stripe/topup-checkout', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
  const amount = Number(req.body.amount || 0);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 500) {
    return res.status(400).json({ error: 'BAD_AMOUNT' });
  }
  const db = await readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const returnPage = ['token', 'checkout', 'room', 'shop', 'session'].includes(req.body.returnPage) ? req.body.returnPage : 'token';
  const base = appBaseUrl(req);
  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: amount * 100,
          product_data: {
            name: `${amount} ROOMIE chips`,
            description: 'Saldo prepagato per prenotazioni e addon Roomie'
          }
        }
      }],
      metadata: {
        userId: user.id,
        chips: String(amount)
      },
      success_url: `${base}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}&return=${returnPage}`,
      cancel_url: `${base}/?page=${returnPage}&stripe=cancelled`
    });
    res.json({ url: checkout.url });
  } catch (_err) {
    res.status(500).json({ error: 'STRIPE_CHECKOUT_ERROR' });
  }
});

app.get('/api/stripe/success', requireAuth, async (req, res) => {
  if (!stripe) return res.redirect(`${appBaseUrl(req)}/?page=token&stripe=not_configured`);
  const sessionId = String(req.query.session_id || '');
  const returnPage = ['token', 'checkout', 'room', 'shop', 'session'].includes(req.query.return) ? req.query.return : 'token';
  try {
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    const result = await creditStripeCheckoutSession(checkout);
    res.redirect(`${appBaseUrl(req)}/?page=${returnPage}&stripe=${result.credited ? 'success' : result.reason === 'ALREADY_CREDITED' ? 'already' : 'pending'}`);
  } catch (_err) {
    res.redirect(`${appBaseUrl(req)}/?page=${returnPage}&stripe=error`);
  }
});

app.get('/api/admin/summary', requireAdmin, async (req, res) => {
  const db = await readDb();
  const bookingRevenue = db.bookings.reduce((sum, b) => sum + Number(b.totalChips || 0), 0);
  const addonRevenue = (db.addonOrders || []).reduce((sum, order) => sum + Number(order.totalChips || 0), 0);
  const usersById = new Map(db.users.map(u => [u.id, u]));
  const enrichedBookings = db.bookings.map(b => {
    ensureBookingAccess(b, db.config);
    const user = usersById.get(b.userId);
    return {
      ...serializeBooking(b),
      userName: user?.name || b.userId || 'utente',
      username: user?.username || '',
      userEmail: user?.email || ''
    };
  });
  await writeDb(db);
  res.json({
    user: publicUser(req.user),
    summary: {
      revenue: bookingRevenue + addonRevenue,
      bookingRevenue,
      addonRevenue,
      bookings: db.bookings.length,
      pending: db.bookings.filter(b => b.status === 'pending').length,
      users: db.users.length,
      chipsInWallets: db.users.reduce((sum, u) => sum + Number(u.chips || 0), 0),
      liveSessions: db.bookings.filter(b => b.liveMode).length
    },
    bookings: enrichedBookings,
    recentBookings: enrichedBookings.slice(0, 10),
    users: db.users.map(publicUser),
    access: {
      shutter: 'online',
      door: 'online',
      lockboxCode: db.config.lockboxCode || '4729',
      power: 'ready',
      lastTap: new Date().toISOString()
    },
    config: db.config,
    addons: db.addons.filter(a => a.status !== 'deleted').map(serializeAddon),
    addonOrders: (db.addonOrders || []).slice(0, 30).map(order => {
      const user = usersById.get(order.userId);
      return {
        ...order,
        userName: user?.name || order.userId || 'utente',
        username: user?.username || ''
      };
    }),
    blockedSlots: db.blockedSlots || [],
    auditLog: db.auditLog.slice(0, 20)
  });
});

app.patch('/api/admin/bookings/:id/status', requireAdmin, async (req, res) => {
  const db = await readDb();
  const booking = db.bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
  const status = String(req.body?.status || '').trim();
  if (!['confirmed', 'pending', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'BAD_STATUS' });
  }
  if (activeStatuses().includes(status) && hasBookingConflict(db, { date: booking.date, start: booking.start, end: booking.end, ignoreId: booking.id })) {
    return res.status(409).json({ error: 'SLOT_BLOCKED' });
  }
  booking.status = status;
  await writeDb(db);
  await logEvent('admin_booking_status', req.user.id, { bookingId: booking.id, status });
  res.json({ booking });
});

app.patch('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  const booking = db.bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
  const nextBooking = { ...booking };
  ['date', 'start', 'end', 'room'].forEach(key => {
    if (req.body[key] !== undefined) nextBooking[key] = req.body[key];
  });
  if (req.body.people !== undefined) nextBooking.people = Number(req.body.people || 1);
  if (req.body.totalChips !== undefined) nextBooking.totalChips = Number(req.body.totalChips || booking.totalChips || 0);
  if (req.body.status !== undefined) {
    const status = String(req.body.status || '').trim();
    if (!['confirmed', 'pending', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'BAD_STATUS' });
    nextBooking.status = status;
  }
  if (activeStatuses().includes(nextBooking.status) && hasBookingConflict(db, { date: nextBooking.date, start: nextBooking.start, end: nextBooking.end, ignoreId: booking.id })) {
    return res.status(409).json({ error: 'SLOT_BLOCKED' });
  }
  Object.assign(booking, nextBooking);
  ensureBookingAccess(booking, db.config);
  booking.accessValidUntil = booking.end || booking.accessValidUntil;
  await writeDb(db);
  await logEvent('admin_booking_update', req.user.id, { bookingId: booking.id });
  res.json({ booking: serializeBooking(booking) });
});

app.patch('/api/admin/users/:id/chips', requireAdmin, async (req, res) => {
  const amount = Number(req.body?.amount || 0);
  if (!Number.isInteger(amount) || amount < -500 || amount > 500 || amount === 0) {
    return res.status(400).json({ error: 'BAD_AMOUNT' });
  }
  const db = await readDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  user.chips = Math.max(0, Number(user.chips || 0) + amount);
  await writeDb(db);
  await logEvent('admin_wallet_adjust', req.user.id, { targetUserId: user.id, amount });
  res.json({ user: publicUser(user) });
});

app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  if (req.body.name !== undefined) user.name = String(req.body.name || user.name).trim();
  if (req.body.email !== undefined) user.email = normalizeEmail(req.body.email);
  if (req.body.role !== undefined) {
    const role = String(req.body.role);
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'BAD_ROLE' });
    user.role = role;
  }
  if (req.body.suspended !== undefined) user.suspended = Boolean(req.body.suspended);
  await writeDb(db);
  await logEvent('admin_user_update', req.user.id, { targetUserId: user.id });
  res.json({ user: publicUser(user) });
});

app.patch('/api/admin/config', requireAdmin, async (req, res) => {
  const db = await readDb();
  db.config = { ...defaultConfig(), ...(db.config || {}) };
  ['hourlyPrice', 'dayPrice', 'guestPassPrice', 'maxPeople'].forEach(key => {
    if (req.body[key] !== undefined) {
      const value = Number(req.body[key]);
      if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'BAD_CONFIG' });
      if (key === 'maxPeople' && (!Number.isInteger(value) || value < 1 || value > 30)) return res.status(400).json({ error: 'BAD_CONFIG' });
      db.config[key] = value;
    }
  });
  if (req.body.lockboxCode !== undefined) {
    const code = String(req.body.lockboxCode || '').replace(/\D/g, '').slice(0, 6);
    if (code.length < 4) return res.status(400).json({ error: 'BAD_CODE' });
    db.config.lockboxCode = code;
  }
  await writeDb(db);
  await logEvent('admin_config_update', req.user.id, db.config);
  res.json({ config: db.config });
});

app.post('/api/admin/addons', requireAdmin, async (req, res) => {
  const db = await readDb();
  const name = String(req.body?.name || '').trim();
  const price = Number(req.body?.price || 0);
  if (!name || !Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'BAD_ADDON' });
  const addon = serializeAddon({
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex'),
    category: req.body?.category || 'featured',
    brand: req.body?.brand || 'ROOMIE',
    name,
    description: req.body?.description || '',
    price,
    status: req.body?.status || 'active',
    soldToday: 0
  });
  db.addons.unshift(addon);
  await writeDb(db);
  await logEvent('admin_addon_create', req.user.id, { addonId: addon.id });
  res.status(201).json({ addon });
});

app.patch('/api/admin/addons/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  const addon = db.addons.find(a => a.id === req.params.id);
  if (!addon) return res.status(404).json({ error: 'ADDON_NOT_FOUND' });
  ['name', 'description', 'brand', 'category', 'status'].forEach(key => {
    if (req.body[key] !== undefined) addon[key] = String(req.body[key]).trim();
  });
  if (req.body.price !== undefined) {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'BAD_PRICE' });
    addon.price = price;
  }
  await writeDb(db);
  await logEvent('admin_addon_update', req.user.id, { addonId: addon.id });
  res.json({ addon: serializeAddon(addon) });
});

app.delete('/api/admin/addons/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  const addon = db.addons.find(a => a.id === req.params.id);
  if (!addon) return res.status(404).json({ error: 'ADDON_NOT_FOUND' });
  addon.status = 'deleted';
  await writeDb(db);
  await logEvent('admin_addon_delete', req.user.id, { addonId: addon.id });
  res.json({ ok: true });
});

app.post('/api/admin/blocked-slots', requireAdmin, async (req, res) => {
  const db = await readDb();
  db.blockedSlots = db.blockedSlots || [];
  const date = req.body?.date;
  const start = req.body?.start;
  const end = req.body?.end;
  if (!date || !start || !end || String(start) >= String(end)) return res.status(400).json({ error: 'BAD_SLOT' });
  const slot = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex'),
    date,
    start,
    end,
    reason: String(req.body?.reason || 'Blocco admin').trim(),
    createdAt: new Date().toISOString()
  };
  db.blockedSlots.unshift(slot);
  await writeDb(db);
  await logEvent('admin_block_slot', req.user.id, slot);
  res.status(201).json({ slot });
});

app.delete('/api/admin/blocked-slots/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  db.blockedSlots = (db.blockedSlots || []).filter(slot => slot.id !== req.params.id);
  await writeDb(db);
  await logEvent('admin_unblock_slot', req.user.id, { slotId: req.params.id });
  res.json({ ok: true });
});

app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
  }
}));

app.get('/ui-preview-v2.html', (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, '/index.html' + query);
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ROOMIE backend running on http://localhost:${PORT}`);
  console.log('Auth API ready: /api/auth/login /api/auth/register');
});
