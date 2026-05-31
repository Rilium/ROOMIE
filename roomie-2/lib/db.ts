// ── DATABASE LAYER ────────────────────────────────────────────────────────────
// Porting 1:1 da server.js. Supporta Neon Postgres (produzione) e
// JSON locale (sviluppo). Stessa logica, stesse funzioni, stesso comportamento.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID, randomBytes, randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import type {
  RoomieDb,
  DbUser,
  PublicUser,
  Booking,
  Addon,
  AppConfig,
  AuditEntry,
  StripeSession,
} from './types'

// ── PATHS ────────────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  ''

const IS_VERCEL = Boolean(process.env.VERCEL)
const ALLOW_LOCAL_DB = !IS_VERCEL && process.env.NODE_ENV !== 'production'

const DATA_DIR = IS_VERCEL
  ? join('/tmp', 'roomie-data')
  : join(process.cwd(), 'data')

const DB_FILE = join(DATA_DIR, 'roomie-db.json')

// ── NEON SQL (lazy singleton) ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let neonSql: any = null
let postgresReady = false

async function getSql() {
  if (!DATABASE_URL) return null
  if (!neonSql) {
    const { neon } = await import('@neondatabase/serverless')
    neonSql = neon(DATABASE_URL)
  }
  return neonSql
}

// ── DEFAULTS ──────────────────────────────────────────────────────────────────

export function defaultConfig(): AppConfig {
  return {
    hourlyPrice: 12,
    dayPrice: 60,
    guestPassPrice: 2,
    maxPeople: 8,
    lockboxCode: '4729',
  }
}

export function defaultAddons(): Addon[] {
  return [
    { id: 'dazn',       category: 'featured', brand: 'DAZN',    name: 'DAZN Partita',      description: 'Champions League · 21:45. Sblocca la partita nella tua sessione.', price: 5,  status: 'active', soldToday: 3 },
    { id: 'cinema',     category: 'featured', brand: 'NETFLIX',  name: 'Cinema Mode',       description: 'Setup audio ottimizzato + Netflix/Prime in fullscreen 75"',        price: 3,  status: 'active', soldToday: 2 },
    { id: 'horror',     category: 'modes',    brand: 'ROOMIE',   name: 'Mood Horror',       description: 'Luci rosse, soundtrack horror, atmosfera da brivido',              price: 4,  status: 'active', soldToday: 0 },
    { id: 'gaming-pro', category: 'modes',    brand: 'PS5',      name: 'Gaming Pro Setup',  description: 'Monitor 240Hz aggiuntivo, headset premium, poggiapolsi',           price: 8,  status: 'active', soldToday: 1 },
    { id: 'neon-party', category: 'modes',    brand: 'SPOTIFY',  name: 'Neon Party',        description: 'Luci RGB animate, music mode, vibe da club',                       price: 5,  status: 'active', soldToday: 0 },
    { id: 'pizza',      category: 'snacks',   brand: 'PARTNER',  name: 'Pizza Margherita',  description: 'Da Marco Pizzeria · Forno a legna',                                price: 9,  status: 'active', soldToday: 2 },
    { id: 'beer',       category: 'snacks',   brand: 'LOCAL',    name: 'Birra Artigianale x4', description: 'IPA locale · Birrificio Torinese',                             price: 12, status: 'active', soldToday: 1 },
    { id: 'snack',      category: 'snacks',   brand: 'MOVIE',    name: 'Snack Box',         description: 'Patatine, popcorn, nachos · Mix 5 pezzi',                          price: 7,  status: 'active', soldToday: 4 },
  ]
}

export function createDefaultDb(): RoomieDb {
  return {
    users: [],
    bookings: [],
    auditLog: [],
    config: defaultConfig(),
    addons: defaultAddons(),
    addonOrders: [],
    blockedSlots: [],
    stripeSessions: [],
  }
}

// ── LOCAL JSON SEED ───────────────────────────────────────────────────────────

function seedDb() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  if (existsSync(DB_FILE)) return
  writeFileSync(DB_FILE, JSON.stringify(createDefaultDb(), null, 2))
}

// ── POSTGRES ──────────────────────────────────────────────────────────────────

async function ensurePostgresDb() {
  const sql = await getSql()
  if (!sql || postgresReady) return sql
  await sql`CREATE TABLE IF NOT EXISTS roomie_state (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`
  const initial = JSON.stringify(createDefaultDb())
  await sql`INSERT INTO roomie_state (id, data)
    VALUES ('main', CAST(${initial} AS jsonb))
    ON CONFLICT (id) DO NOTHING`
  postgresReady = true
  return sql
}

// ── NORMALIZE ─────────────────────────────────────────────────────────────────

function removeLegacyAdminSeed(db: RoomieDb): boolean {
  const hasConfiguredAdmin = Boolean(
    process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_HASH,
  )
  if (hasConfiguredAdmin) return false
  const idx = db.users.findIndex(
    u =>
      u &&
      u.id === 'usr_admin' &&
      normalizeUsername(u.username) === 'admin' &&
      u.name === 'System Admin' &&
      u.role === 'admin' &&
      u.passwordHash &&
      bcrypt.compareSync('admin', u.passwordHash),
  )
  if (idx === -1) return false
  db.users.splice(idx, 1)
  return true
}

function applyAdminBootstrap(db: RoomieDb): boolean {
  const password = process.env.ADMIN_PASSWORD || ''
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || ''
  if (!password && !passwordHash) return false
  const username = normalizeUsername(process.env.ADMIN_USERNAME || 'admin')
  const name = String(process.env.ADMIN_NAME || 'ROOMIE Admin').trim()
  let changed = false
  let admin =
    db.users.find(u => u.role === 'admin') ||
    db.users.find(u => normalizeUsername(u.username) === username)
  if (!admin) {
    admin = {
      id: 'usr_admin',
      username,
      name,
      role: 'admin',
      chips: 999,
      passwordHash: passwordHash || bcrypt.hashSync(password, 10),
      createdAt: new Date().toISOString(),
    }
    db.users.push(admin)
    return true
  }
  const nextHash = passwordHash || bcrypt.hashSync(password, 10)
  if (normalizeUsername(admin.username) !== username) {
    admin.username = username
    changed = true
  }
  if (admin.name !== name) {
    admin.name = name
    changed = true
  }
  if (admin.role !== 'admin') {
    admin.role = 'admin'
    changed = true
  }
  if (admin.suspended) {
    admin.suspended = false
    changed = true
  }
  if (
    !admin.passwordHash ||
    !bcrypt.compareSync(
      password || randomBytes(18).toString('hex'),
      admin.passwordHash,
    )
  ) {
    if (admin.passwordHash !== nextHash) {
      admin.passwordHash = nextHash
      changed = true
    }
  }
  return changed
}

export function normalizeDb(db: RoomieDb): { db: RoomieDb; changed: boolean } {
  let changed = false
  if (!db.config) {
    db.config = defaultConfig()
    changed = true
  }
  if (!Array.isArray(db.addons)) {
    db.addons = defaultAddons()
    changed = true
  }
  if (!Array.isArray(db.addonOrders)) {
    db.addonOrders = []
    changed = true
  }
  if (!Array.isArray(db.blockedSlots)) {
    db.blockedSlots = []
    changed = true
  }
  if (!Array.isArray(db.stripeSessions)) {
    db.stripeSessions = []
    changed = true
  }
  if (removeLegacyAdminSeed(db)) changed = true
  if (applyAdminBootstrap(db)) changed = true
  return { db, changed }
}

// ── READ / WRITE ──────────────────────────────────────────────────────────────

export async function readDb(): Promise<RoomieDb> {
  if (DATABASE_URL) {
    const sql = await ensurePostgresDb()
    const rows = await sql`SELECT data FROM roomie_state WHERE id = 'main' LIMIT 1`
    const state: RoomieDb = rows[0]?.data || createDefaultDb()
    const { db, changed } = normalizeDb(state)
    if (changed) await writeDb(db)
    return db
  }
  if (!ALLOW_LOCAL_DB) {
    throw new Error('STORAGE_NOT_CONFIGURED')
  }
  seedDb()
  const raw = JSON.parse(readFileSync(DB_FILE, 'utf8')) as RoomieDb
  const { db, changed } = normalizeDb(raw)
  if (changed) await writeDb(db)
  return db
}

export async function writeDb(db: RoomieDb): Promise<void> {
  if (DATABASE_URL) {
    const sql = await ensurePostgresDb()
    const data = JSON.stringify(db)
    await sql`INSERT INTO roomie_state (id, data, updated_at)
      VALUES ('main', CAST(${data} AS jsonb), NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`
    return
  }
  if (!ALLOW_LOCAL_DB) {
    throw new Error('STORAGE_NOT_CONFIGURED')
  }
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

export function publicUser(user: DbUser | null | undefined): PublicUser | null {
  if (!user) return null
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    name: user.name,
    role: user.role,
    chips: user.chips,
    suspended: Boolean(user.suspended),
  }
}

export function normalizeUsername(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function normalizeEmail(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function safeUsernameFromEmail(
  email: string,
  fallback = 'roomie',
): string {
  const base =
    normalizeUsername(String(email || fallback).split('@')[0])
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 16) || 'roomie'
  return base.length >= 3 ? base : `${base}_user`
}

export function uniqueUsername(db: RoomieDb, seed: string): string {
  let username = seed
  let suffix = 1
  while (db.users.some(u => normalizeUsername(u.username) === username)) {
    const trimmed = seed.slice(0, Math.max(3, 20 - String(suffix).length - 1))
    username = `${trimmed}_${suffix}`
    suffix += 1
  }
  return username
}

export async function logEvent(
  type: string,
  userId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const db = await readDb()
  const entry: AuditEntry = {
    id: randomUUID(),
    type,
    userId,
    details,
    createdAt: new Date().toISOString(),
  }
  db.auditLog.unshift(entry)
  db.auditLog = db.auditLog.slice(0, 100)
  await writeDb(db)
}

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return false
  const toMinutes = (value: string) => {
    const [hh, mm] = String(value).split(':').map(Number)
    return (Number(hh || 0) * 60) + Number(mm || 0)
  }
  const expand = (start: string, end: string): [number, number][] => {
    const s = toMinutes(start)
    let e = toMinutes(end)
    if (e <= s) e += 1440
    return [
      [s, e],
      [s + 1440, e + 1440],
    ]
  }
  const a = expand(aStart, aEnd)
  const b = expand(bStart, bEnd)
  return a.some(([as, ae]) => b.some(([bs, be]) => as < be && ae > bs))
}

export function addHoursToTime(time: string, hours: number): string {
  const [hh, mm] = String(time || '00:00').split(':').map(Number)
  const totalMinutes =
    (Number(hh || 0) * 60) + Number(mm || 0) + Number(hours || 0) * 60
  const next = ((totalMinutes % 1440) + 1440) % 1440
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`
}

export function makeCode(length = 4): string {
  const max = 10 ** length
  return String(randomInt(0, max)).padStart(length, '0')
}

export function activeStatuses(): string[] {
  return ['confirmed', 'pending']
}

export function hasBookingConflict(
  db: RoomieDb,
  {
    date,
    start,
    end,
    ignoreId = null,
  }: { date: string; start: string; end: string; ignoreId?: string | null },
): boolean {
  if (!date || !start || !end) return false
  const blocked = (db.blockedSlots || []).some(
    slot =>
      slot.date === date && overlaps(start, end, slot.start, slot.end),
  )
  const booked = (db.bookings || []).some(booking => {
    if (ignoreId && booking.id === ignoreId) return false
    if (!activeStatuses().includes(booking.status)) return false
    return booking.date === date && overlaps(start, end, booking.start, booking.end)
  })
  return blocked || booked
}

export function ensureBookingAccess(
  booking: Booking,
  config: AppConfig = defaultConfig(),
): Booking {
  if (!booking.lockboxCode) booking.lockboxCode = config.lockboxCode || makeCode(4)
  if (!booking.doorCode) booking.doorCode = makeCode(4)
  if (!booking.accessValidUntil) booking.accessValidUntil = booking.end || '23:00'
  return booking
}

export async function creditStripeCheckoutSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
): Promise<{ credited: boolean; reason?: string; user?: PublicUser | null; amount?: number }> {
  if (!session || session.payment_status !== 'paid') {
    return { credited: false, reason: 'NOT_PAID' }
  }
  const sessionId: string = session.id
  const userId: string = session.metadata?.userId
  const amount = Number(session.metadata?.chips || 0)
  if (
    !sessionId ||
    !userId ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    amount > 500
  ) {
    return { credited: false, reason: 'BAD_METADATA' }
  }
  const db = await readDb()
  if ((db.stripeSessions || []).some(item => item.id === sessionId)) {
    return { credited: false, reason: 'ALREADY_CREDITED' }
  }
  const user = db.users.find(u => u.id === userId)
  if (!user) return { credited: false, reason: 'USER_NOT_FOUND' }
  user.chips = Number(user.chips || 0) + amount
  const stripeEntry: StripeSession = {
    id: sessionId,
    userId,
    amount,
    paymentIntent: session.payment_intent || '',
    createdAt: new Date().toISOString(),
  }
  ;(db.stripeSessions ||= []).unshift(stripeEntry)
  await writeDb(db)
  await logEvent('stripe_wallet_topup', user.id, { amount, sessionId })
  return { credited: true, user: publicUser(user), amount }
}

export function serializeBooking(booking: Booking): Booking {
  return {
    ...booking,
    lockboxCode: booking.lockboxCode || '',
    doorCode: booking.doorCode || '',
    accessValidUntil: booking.accessValidUntil || booking.end || '',
  }
}

export function serializeAddon(addon: Addon): Addon {
  return {
    id: addon.id,
    category: addon.category || 'featured',
    brand: addon.brand || 'ROOMIE',
    name: addon.name,
    description: addon.description || '',
    price: Number(addon.price || 0),
    status: addon.status || 'active',
    soldToday: Number(addon.soldToday || 0),
  }
}

export function bookingStartDate(booking: Booking): Date {
  const date = booking?.date || '1970-01-01'
  const start = booking?.start || '00:00'
  const value = new Date(`${date}T${start}:00`)
  return Number.isNaN(value.getTime()) ? new Date(0) : value
}

export function buildDashboardSummary(user: DbUser, db: RoomieDb) {
  const now = new Date()
  const bookings = (db.bookings || [])
    .filter(b => b.userId === user.id)
    .map(b => serializeBooking(ensureBookingAccess(b, db.config)))
  const sorted = [...bookings].sort(
    (a, b) => bookingStartDate(a).getTime() - bookingStartDate(b).getTime(),
  )
  const upcoming = sorted.filter(
    b => activeStatuses().includes(b.status) && bookingStartDate(b) >= now,
  )
  const next =
    upcoming[0] ||
    sorted.find(b => activeStatuses().includes(b.status)) ||
    null
  const completed = bookings.filter(b =>
    ['confirmed', 'completed'].includes(b.status),
  )
  const monthCount = completed.filter(b => {
    const d = bookingStartDate(b)
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    )
  }).length
  const totalSpent = bookings.reduce(
    (sum, b) => sum + Number(b.totalChips || 0),
    0,
  )
  const toNeon = Math.max(0, 5 - monthCount)
  const favorite = completed.reduce<Record<string, number>>((acc, b) => {
    const key = `${b.start || '20:00'}|${bookingStartDate(b).getDay()}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const favoriteKey =
    Object.entries(favorite).sort((a, b) => b[1] - a[1])[0]?.[0] || '20:00|5'
  const [favoriteStart, favoriteDay] = favoriteKey.split('|')
  const recommended = {
    dayIndex: Number(favoriteDay || 5),
    start: favoriteStart || '20:00',
    durationHours: 2,
    title: bookings.length
      ? 'Riprendi il tuo slot forte'
      : 'Prima sessione consigliata',
    copy: bookings.length
      ? 'Stesso ritmo del tuo gruppo, meno decisioni da prendere.'
      : 'Ranked Session da 2h: prezzo chiaro, esperienza completa, zero overthinking.',
  }
  const mission = next
    ? {
        title: 'Arriva senza attrito',
        copy: 'Codici, accesso guidato e addon sono pronti nella prossima sessione.',
        cta: 'APRI ACCESSO',
        page: 'confirm',
      }
    : user.chips >= Number(db.config?.hourlyPrice || 12)
      ? {
          title: 'Blocca la prima serata',
          copy: 'Hai già chips per partire. Scegli preset, ora e gruppo.',
          cta: 'PRENOTA ORA',
          page: 'room',
        }
      : {
          title: 'Carica la chip',
          copy: 'Ricarica il saldo e blocca il primo slot senza uscire dal flow.',
          cta: 'RICARICA',
          page: 'token',
        }
  const recommendedAddons = (db.addons || [])
    .filter(a => a.status === 'active')
    .sort((a, b) => Number(b.soldToday || 0) - Number(a.soldToday || 0))
    .slice(0, 3)
    .map(serializeAddon)
  return {
    user: publicUser(user),
    bookings,
    next,
    history: [...bookings]
      .sort(
        (a, b) =>
          bookingStartDate(b).getTime() - bookingStartDate(a).getTime(),
      )
      .slice(0, 6),
    stats: {
      totalBookings: bookings.length,
      totalSpent,
      monthCount,
      toNeon,
      chips: Number(user.chips || 0),
    },
    mission,
    recommended,
    recommendedAddons,
  }
}

export function upsertGoogleUserFromProfileFactory() {
  return async function upsertGoogleUserFromProfile(profile: {
    email?: string
    sub?: string
    name?: string
    picture?: string
  }): Promise<DbUser | null> {
    const email = normalizeEmail(profile.email)
    if (!email) return null
    const db = await readDb()
    let user = db.users.find(
      u =>
        normalizeEmail(u.email) === email ||
        (u.provider === 'google' && u.providerId === String(profile.sub || '')),
    )
    if (!user) {
      user = {
        id: randomUUID(),
        username: uniqueUsername(db, safeUsernameFromEmail(email, 'google')),
        email,
        name: String(profile.name || email.split('@')[0]).trim(),
        role: 'user',
        chips: 24,
        provider: 'google',
        providerId: String(profile.sub || ''),
        avatar: profile.picture || '',
        passwordHash: bcrypt.hashSync(randomBytes(24).toString('hex'), 10),
        createdAt: new Date().toISOString(),
      }
      db.users.push(user)
      await writeDb(db)
      await logEvent('social_register', user.id, { provider: 'google', email })
    } else {
      user.provider = user.provider || 'google'
      user.providerId = user.providerId || String(profile.sub || '')
      user.avatar = user.avatar || profile.picture || ''
      user.name =
        user.name || String(profile.name || email.split('@')[0]).trim()
      await writeDb(db)
    }
    return user
  }
}

export const upsertGoogleUserFromProfile =
  upsertGoogleUserFromProfileFactory()

// Seed locale all'avvio (solo dev/non-Vercel)
if (ALLOW_LOCAL_DB && !DATABASE_URL) {
  try { seedDb() } catch (_) { /* noop */ }
}
