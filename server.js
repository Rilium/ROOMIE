const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'roomie-db.json');

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

function seedDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) return;

  const now = new Date().toISOString();
  const db = {
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
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function readDb() {
  seedDb();
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  let changed = false;
  if (!db.config) { db.config = defaultConfig(); changed = true; }
  if (!Array.isArray(db.addons)) { db.addons = defaultAddons(); changed = true; }
  if (!Array.isArray(db.addonOrders)) { db.addonOrders = []; changed = true; }
  if (!Array.isArray(db.blockedSlots)) { db.blockedSlots = []; changed = true; }
  if (changed) writeDb(db);
  return db;
}

function writeDb(db) {
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

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  next();
}

function requireAdmin(req, res, next) {
  const db = readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'ADMIN_REQUIRED' });
  req.user = user;
  next();
}

function logEvent(type, userId, details = {}) {
  const db = readDb();
  db.auditLog.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex'),
    type,
    userId,
    details,
    createdAt: new Date().toISOString()
  });
  db.auditLog = db.auditLog.slice(0, 100);
  writeDb(db);
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

seedDb();

app.use(express.json());
app.use(session({
  name: 'roomie.sid',
  secret: process.env.SESSION_SECRET || 'roomie-local-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 12
  }
}));

app.post('/api/auth/login', (req, res) => {
  const { username, password, remember } = req.body || {};
  const db = readDb();
  const login = normalizeUsername(username);
  const user = db.users.find(u => u.username === login || normalizeEmail(u.email) === login);
  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'BAD_CREDENTIALS' });
  }
  if (user.suspended) return res.status(403).json({ error: 'USER_SUSPENDED' });
  if (remember) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
  req.session.userId = user.id;
  logEvent('login', user.id, { username: user.username });
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/register', (req, res) => {
  const db = readDb();
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
  writeDb(db);
  if (remember) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
  req.session.userId = user.id;
  logEvent('register', user.id, { username, email });
  res.status(201).json({ user: publicUser(user) });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const userId = req.session.userId;
  req.session.destroy(() => {
    logEvent('logout', userId);
    res.clearCookie('roomie.sid');
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ user: null });
  const db = readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ user: null });
  res.json({ user: publicUser(user) });
});

app.get('/api/app/config', (_req, res) => {
  const db = readDb();
  res.json({
    config: db.config,
    blockedSlots: db.blockedSlots || [],
    bookedSlots: (db.bookings || [])
      .filter(b => activeStatuses().includes(b.status))
      .map(b => ({ id: b.id, date: b.date, start: b.start, end: b.end, status: b.status }))
  });
});

app.get('/api/addons', (_req, res) => {
  const db = readDb();
  res.json({ addons: db.addons.filter(a => a.status !== 'deleted').map(serializeAddon) });
});

app.post('/api/addon-orders', requireAuth, (req, res) => {
  const db = readDb();
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
  writeDb(db);
  logEvent('addon_order_paid', user.id, { orderId: order.id, totalChips });
  res.status(201).json({ order, user: publicUser(user) });
});

app.get('/api/bookings', requireAuth, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  const bookings = user.role === 'admin'
    ? db.bookings
    : db.bookings.filter(b => b.userId === user.id);
  bookings.forEach(b => ensureBookingAccess(b, db.config));
  writeDb(db);
  res.json({ bookings: bookings.map(serializeBooking) });
});

app.post('/api/bookings', requireAuth, (req, res) => {
  const db = readDb();
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
  writeDb(db);
  logEvent('booking_created', req.session.userId, { bookingId: id, totalChips });
  res.status(201).json({ booking: serializeBooking(booking), user: publicUser(user) });
});

app.post('/api/bookings/:id/extend', requireAuth, (req, res) => {
  const db = readDb();
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
  writeDb(db);
  logEvent('booking_extended', user.id, { bookingId: booking.id, hours, price });
  res.json({ booking: serializeBooking(booking), user: publicUser(user), charged: user.role === 'admin' ? 0 : price });
});

app.post('/api/wallet/topup', requireAuth, (req, res) => {
  const amount = Number(req.body.amount || 0);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 500) {
    return res.status(400).json({ error: 'BAD_AMOUNT' });
  }
  const db = readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  user.chips += amount;
  writeDb(db);
  logEvent('wallet_topup', user.id, { amount });
  res.json({ user: publicUser(user), amount });
});

app.get('/api/admin/summary', requireAdmin, (req, res) => {
  const db = readDb();
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
  writeDb(db);
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

app.patch('/api/admin/bookings/:id/status', requireAdmin, (req, res) => {
  const db = readDb();
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
  writeDb(db);
  logEvent('admin_booking_status', req.user.id, { bookingId: booking.id, status });
  res.json({ booking });
});

app.patch('/api/admin/bookings/:id', requireAdmin, (req, res) => {
  const db = readDb();
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
  writeDb(db);
  logEvent('admin_booking_update', req.user.id, { bookingId: booking.id });
  res.json({ booking: serializeBooking(booking) });
});

app.patch('/api/admin/users/:id/chips', requireAdmin, (req, res) => {
  const amount = Number(req.body?.amount || 0);
  if (!Number.isInteger(amount) || amount < -500 || amount > 500 || amount === 0) {
    return res.status(400).json({ error: 'BAD_AMOUNT' });
  }
  const db = readDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  user.chips = Math.max(0, Number(user.chips || 0) + amount);
  writeDb(db);
  logEvent('admin_wallet_adjust', req.user.id, { targetUserId: user.id, amount });
  res.json({ user: publicUser(user) });
});

app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const db = readDb();
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
  writeDb(db);
  logEvent('admin_user_update', req.user.id, { targetUserId: user.id });
  res.json({ user: publicUser(user) });
});

app.patch('/api/admin/config', requireAdmin, (req, res) => {
  const db = readDb();
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
  writeDb(db);
  logEvent('admin_config_update', req.user.id, db.config);
  res.json({ config: db.config });
});

app.post('/api/admin/addons', requireAdmin, (req, res) => {
  const db = readDb();
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
  writeDb(db);
  logEvent('admin_addon_create', req.user.id, { addonId: addon.id });
  res.status(201).json({ addon });
});

app.patch('/api/admin/addons/:id', requireAdmin, (req, res) => {
  const db = readDb();
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
  writeDb(db);
  logEvent('admin_addon_update', req.user.id, { addonId: addon.id });
  res.json({ addon: serializeAddon(addon) });
});

app.delete('/api/admin/addons/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const addon = db.addons.find(a => a.id === req.params.id);
  if (!addon) return res.status(404).json({ error: 'ADDON_NOT_FOUND' });
  addon.status = 'deleted';
  writeDb(db);
  logEvent('admin_addon_delete', req.user.id, { addonId: addon.id });
  res.json({ ok: true });
});

app.post('/api/admin/blocked-slots', requireAdmin, (req, res) => {
  const db = readDb();
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
  writeDb(db);
  logEvent('admin_block_slot', req.user.id, slot);
  res.status(201).json({ slot });
});

app.delete('/api/admin/blocked-slots/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.blockedSlots = (db.blockedSlots || []).filter(slot => slot.id !== req.params.id);
  writeDb(db);
  logEvent('admin_unblock_slot', req.user.id, { slotId: req.params.id });
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
