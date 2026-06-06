// ── lib/neon-db.ts ────────────────────────────────────────────────────────────
// Relational DB layer for ROOMIE — Neon PostgreSQL.
// Single source of truth for users, bookings, wallet, addons, access and admin.
// Run db/001_initial_schema.sql against Neon before first production use.

import bcrypt from 'bcryptjs'
import { sqlClient } from './db/client'
import type {
  DbUser,
  PublicUser,
  Booking,
  Addon,
  AddonOrder,
  AppConfig,
  BlockedSlot,
  AuditEntry,
} from './types'
import { bookingAccessUntilIso, isValidEmailString, normalizeEmail } from './utils'

// ── CONNECTION ────────────────────────────────────────────────────────────────

function getDb() {
  return sqlClient()
}

const DEFAULT_ADDONS: Addon[] = [
  { id: 'dazn',       category: 'featured', brand: 'DAZN',    name: 'DAZN Partita',        description: 'Champions League, Serie A e big match dentro la sessione.', price: 5,  status: 'active', soldToday: 3 },
  { id: 'cinema',     category: 'featured', brand: 'NETFLIX',  name: 'Cinema Mode',         description: 'Audio ottimizzato, streaming fullscreen e luci basse.',      price: 3,  status: 'active', soldToday: 2 },
  { id: 'horror',     category: 'modes',    brand: 'ROOMIE',   name: 'Mood Horror',         description: 'Luci rosse, atmosfera dark e setup da film.',                price: 4,  status: 'active', soldToday: 0 },
  { id: 'gaming-pro', category: 'modes',    brand: 'PS5',      name: 'Gaming Pro Setup',    description: 'Monitor extra, headset premium e setup competitivo.',        price: 8,  status: 'active', soldToday: 1 },
  { id: 'neon-party', category: 'modes',    brand: 'SPOTIFY',  name: 'Neon Party',          description: 'Luci dinamiche e playlist pronta per la serata.',            price: 5,  status: 'active', soldToday: 0 },
  { id: 'pizza',      category: 'snacks',   brand: 'PARTNER',  name: 'Pizza Margherita',    description: 'Delivery partner locale, pronta durante la sessione.',       price: 9,  status: 'active', soldToday: 2 },
  { id: 'beer',       category: 'snacks',   brand: 'LOCAL',    name: 'Birra Artigianale x4', description: 'Quattro birre locali fredde.',                              price: 12, status: 'active', soldToday: 1 },
  { id: 'snack',      category: 'snacks',   brand: 'MOVIE',    name: 'Snack Box',           description: 'Popcorn, patatine, nachos e mix dolce/salato.',              price: 7,  status: 'active', soldToday: 4 },
]

let bootstrapPromise: Promise<void> | null = null

export async function ensureBootstrapData(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const sql = getDb()

      await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`

      await sql`ALTER TABLE addons ADD COLUMN IF NOT EXISTS sold_today_date DATE NOT NULL DEFAULT CURRENT_DATE`

      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id TEXT UNIQUE`
      await sql`CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users (clerk_id)`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_verification_status TEXT NOT NULL DEFAULT 'missing'`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_type TEXT`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_last4 TEXT`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_name TEXT`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_verified_at TIMESTAMPTZ`

      await sql`
        CREATE TABLE IF NOT EXISTS rate_limits (
          key TEXT PRIMARY KEY,
          count INT NOT NULL DEFAULT 0,
          expires_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `

      await sql`
        CREATE TABLE IF NOT EXISTS audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          user_id TEXT,
          details JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `

      await sql`
        INSERT INTO config (id)
        VALUES (1)
        ON CONFLICT (id) DO NOTHING
      `

      for (const [index, addon] of DEFAULT_ADDONS.entries()) {
        await sql`
          INSERT INTO addons (id, category, brand, name, description, price, status, sold_today, sort_order)
          VALUES (
            ${addon.id},
            ${addon.category},
            ${addon.brand},
            ${addon.name},
            ${addon.description},
            ${addon.price},
            ${addon.status},
            ${addon.soldToday},
            ${(index + 1) * 10}
          )
          ON CONFLICT (id) DO NOTHING
        `
      }

      await resetAddonCountersIfNeeded()

      const adminPassword = process.env.ADMIN_PASSWORD || ''
      const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || ''
      if (adminPassword || adminPasswordHash) {
        const username = String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase()
        const email = String(process.env.ADMIN_EMAIL || 'admin@roomie.local').trim().toLowerCase()
        const name = String(process.env.ADMIN_NAME || 'ROOMIE Admin').trim()
        const passwordHash = adminPasswordHash || bcrypt.hashSync(adminPassword, 10)

        await sql`
          INSERT INTO users (id, username, email, name, role, chips, password_hash, suspended)
          VALUES ('usr_admin', ${username}, ${email}, ${name}, 'admin', 999, ${passwordHash}, FALSE)
          ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            role = 'admin',
            chips = GREATEST(users.chips, 999),
            password_hash = EXCLUDED.password_hash,
            suspended = FALSE,
            updated_at = NOW()
        `
      }
    })().catch(err => {
      bootstrapPromise = null
      throw err
    })
  }
  return bootstrapPromise
}

// ── UTILS ─────────────────────────────────────────────────────────────────────

export function publicUser(u: DbUser): PublicUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email ?? '',
    name: u.name,
    role: u.role,
    chips: u.chips,
    suspended: u.suspended ?? false,
    avatar: u.avatar ?? null,
    termsAcceptedAt: u.termsAcceptedAt ?? null,
    privacyAcceptedAt: u.privacyAcceptedAt ?? null,
    documentVerificationStatus: u.documentVerificationStatus ?? 'missing',
    documentType: u.documentType ?? null,
    documentLast4: u.documentLast4 ?? null,
    documentName: u.documentName ?? null,
    documentVerifiedAt: u.documentVerifiedAt ?? null,
  }
}

// ── CONFIG ────────────────────────────────────────────────────────────────────

export async function getConfig(): Promise<AppConfig> {
  await ensureBootstrapData()
  const sql = getDb()
  const rows = await sql`SELECT * FROM config WHERE id = 1`
  const row = rows[0]
  if (!row) return { hourlyPrice: 12, dayPrice: 60, guestPassPrice: 2, maxPeople: 8, lockboxCode: '' }
  return {
    hourlyPrice:    Number(row.hourly_price),
    dayPrice:       Number(row.day_price),
    guestPassPrice: Number(row.guest_pass_price),
    maxPeople:      Number(row.max_people),
    lockboxCode:    String(row.lockbox_code),
  }
}

export async function patchConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  await ensureBootstrapData()
  const sql = getDb()
  await sql`
    UPDATE config SET
      hourly_price     = COALESCE(${patch.hourlyPrice    ?? null}, hourly_price),
      day_price        = COALESCE(${patch.dayPrice       ?? null}, day_price),
      guest_pass_price = COALESCE(${patch.guestPassPrice ?? null}, guest_pass_price),
      max_people       = COALESCE(${patch.maxPeople      ?? null}, max_people),
      lockbox_code     = COALESCE(${patch.lockboxCode    ?? null}, lockbox_code),
      updated_at       = NOW()
    WHERE id = 1
  `
  return getConfig()
}

// ── USERS ─────────────────────────────────────────────────────────────────────

function rowToDbUser(r: Record<string, unknown>): DbUser {
  return {
    id:           String(r.id),
    username:     String(r.username),
    email:        r.email ? String(r.email) : undefined,
    name:         String(r.name),
    role:         (r.role as 'user' | 'admin') ?? 'user',
    chips:        Number(r.chips ?? 0),
    passwordHash: String(r.password_hash ?? ''),
    suspended:    Boolean(r.suspended ?? false),
    provider:     r.provider ? String(r.provider) : undefined,
    providerId:   r.provider_id ? String(r.provider_id) : undefined,
    avatar:       r.avatar ? String(r.avatar) : undefined,
    termsAcceptedAt: r.terms_accepted_at ? new Date(r.terms_accepted_at as string).toISOString() : null,
    privacyAcceptedAt: r.privacy_accepted_at ? new Date(r.privacy_accepted_at as string).toISOString() : null,
    documentVerificationStatus: (r.document_verification_status as DbUser['documentVerificationStatus']) ?? 'missing',
    documentType: r.document_type ? (String(r.document_type) as DbUser['documentType']) : null,
    documentLast4: r.document_last4 ? String(r.document_last4) : null,
    documentName: r.document_name ? String(r.document_name) : null,
    documentVerifiedAt: r.document_verified_at ? new Date(r.document_verified_at as string).toISOString() : null,
    createdAt:    r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
  }
}

export async function getUserById(id: string): Promise<DbUser | null> {
  await ensureBootstrapData()
  const sql = getDb()
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function getUserByUsername(username: string): Promise<DbUser | null> {
  await ensureBootstrapData()
  const sql = getDb()
  const rows = await sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  await ensureBootstrapData()
  const sql = getDb()
  const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function getUserByProvider(provider: string, providerId: string): Promise<DbUser | null> {
  await ensureBootstrapData()
  const sql = getDb()
  const rows = await sql`SELECT * FROM users WHERE provider = ${provider} AND provider_id = ${providerId} LIMIT 1`
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function createUser(data: {
  id: string
  username: string
  email: string
  name: string
  role?: 'user' | 'admin'
  chips?: number
  passwordHash?: string
  provider?: string
  providerId?: string
  avatar?: string
}): Promise<DbUser> {
  await ensureBootstrapData()
  const sql = getDb()
  const rows = await sql`
    INSERT INTO users (id, username, email, name, role, chips, password_hash, provider, provider_id, avatar)
    VALUES (
      ${data.id},
      ${data.username},
      ${data.email},
      ${data.name},
      ${data.role ?? 'user'},
      ${data.chips ?? 0},
      ${data.passwordHash ?? null},
      ${data.provider ?? null},
      ${data.providerId ?? null},
      ${data.avatar ?? null}
    )
    RETURNING *
  `
  return rowToDbUser(rows[0])
}

export async function updateUserChips(userId: string, chips: number): Promise<void> {
  const sql = getDb()
  await sql`UPDATE users SET chips = ${chips} WHERE id = ${userId}`
}

export async function adjustUserChips(userId: string, delta: number): Promise<number> {
  const sql = getDb()
  const rows = await sql`
    UPDATE users SET chips = GREATEST(0, chips + ${delta})
    WHERE id = ${userId}
    RETURNING chips
  `
  return Number(rows[0]?.chips ?? 0)
}

export async function adjustUserChipsWithTransaction(
  userId: string,
  amount: number,
  adminId: string,
  reason: string,
): Promise<number> {
  const sql = getDb()
  const noteStr = `admin:${adminId}:${reason}`
  const rows = await sql`
    WITH
      chip_update AS (
        UPDATE users SET chips = GREATEST(0, chips + ${amount})
        WHERE id = ${userId}
        RETURNING chips
      ),
      _tx AS (
        INSERT INTO wallet_transactions (user_id, type, chips_delta, chips_after, ref_id, note)
        SELECT ${userId}, 'admin_adjustment', ${amount}, chips, ${adminId}, ${noteStr}
        FROM chip_update
      )
    SELECT chips AS new_chips FROM chip_update
  `
  return Number(rows[0]?.new_chips ?? 0)
}

export async function patchUserAdmin(
  id: string,
  updates: Partial<Pick<DbUser, 'name' | 'email' | 'role' | 'suspended'>>,
): Promise<DbUser | null> {
  const sql = getDb()
  const rows = await sql`
    UPDATE users SET
      name      = COALESCE(${updates.name ?? null}, name),
      email     = COALESCE(${updates.email ?? null}, email),
      role      = COALESCE(${updates.role ?? null}, role),
      suspended = COALESCE(${updates.suspended ?? null}, suspended)
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function patchOwnUserProfile(
  id: string,
  updates: Partial<Pick<DbUser, 'name' | 'username'>>,
): Promise<DbUser | null> {
  const sql = getDb()
  const rows = await sql`
    UPDATE users SET
      name = COALESCE(${updates.name ?? null}, name),
      username = COALESCE(${updates.username ?? null}, username),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function acceptUserLegal(userId: string): Promise<DbUser | null> {
  await ensureBootstrapData()
  const sql = getDb()
  const rows = await sql`
    UPDATE users SET
      terms_accepted_at = COALESCE(terms_accepted_at, NOW()),
      privacy_accepted_at = COALESCE(privacy_accepted_at, NOW()),
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function revokeUserLegal(userId: string): Promise<DbUser | null> {
  await ensureBootstrapData()
  const sql = getDb()
  const rows = await sql`
    UPDATE users SET
      terms_accepted_at = NULL,
      privacy_accepted_at = NULL,
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function mockVerifyUserDocument(
  userId: string,
  data: {
    documentType: 'id_card' | 'driver_license'
    documentLast4: string
    documentName: string
  },
): Promise<DbUser | null> {
  await ensureBootstrapData()
  const sql = getDb()
  const rows = await sql`
    UPDATE users SET
      document_verification_status = 'mock_verified',
      document_type = ${data.documentType},
      document_last4 = ${data.documentLast4},
      document_name = ${data.documentName},
      document_verified_at = NOW(),
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function listUsers(): Promise<DbUser[]> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM users ORDER BY created_at DESC`
  return rows.map(rowToDbUser)
}

// ── WALLET TRANSACTIONS ───────────────────────────────────────────────────────

export async function recordTransaction(data: {
  userId: string
  type: 'topup' | 'booking_debit' | 'addon_debit' | 'refund' | 'admin_adjustment' | 'cashback'
  chipsDelta: number
  chipsAfter: number
  refId?: string
  note?: string
}): Promise<void> {
  const sql = getDb()
  await sql`
    INSERT INTO wallet_transactions (user_id, type, chips_delta, chips_after, ref_id, note)
    VALUES (${data.userId}, ${data.type}, ${data.chipsDelta}, ${data.chipsAfter}, ${data.refId ?? null}, ${data.note ?? null})
  `
}

// ── BOOKINGS ──────────────────────────────────────────────────────────────────

function rowToBooking(r: Record<string, unknown>): Booking {
  return {
    id:               String(r.id),
    userId:           String(r.user_id),
    room:             String(r.room ?? 'Via Terni'),
    date:             r.date ? new Date(r.date as string).toISOString().slice(0, 10) : '',
    start:            String(r.start_time ?? '').slice(0, 5),
    end:              String(r.end_time ?? '').slice(0, 5),
    people:           Number(r.people ?? 1),
    totalChips:       Number(r.total_chips ?? 0),
    status:           (r.status as Booking['status']) ?? 'confirmed',
    lockboxCode:      r.lockbox_code ? String(r.lockbox_code) : undefined,
    doorCode:         r.door_code ? String(r.door_code) : undefined,
    accessValidUntil: r.access_valid_until ? new Date(r.access_valid_until as string).toISOString() : undefined,
    liveMode:         Boolean(r.live_mode ?? false),
    createdAt:        r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
  }
}

export async function createBooking(data: {
  id: string
  userId: string
  room?: string
  date: string
  start: string
  end: string
  people: number
  preset: string
  durationHours: number
  guests: number
  totalChips: number
  liveMode?: boolean
  lockboxCode?: string
  doorCode?: string
  accessValidFrom?: string
  accessValidUntil?: string
}): Promise<Booking> {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO bookings (
      id, user_id, room, date, start_time, end_time, people,
      preset, duration_hours, guests, total_chips, live_mode,
      lockbox_code, door_code, access_valid_from, access_valid_until
    ) VALUES (
      ${data.id},
      ${data.userId},
      ${data.room ?? 'Via Terni'},
      ${data.date}::date,
      ${data.start}::time,
      ${data.end}::time,
      ${data.people},
      ${data.preset},
      ${data.durationHours},
      ${data.guests},
      ${data.totalChips},
      ${data.liveMode ?? false},
      ${data.lockboxCode ?? null},
      ${data.doorCode ?? null},
      ${data.accessValidFrom ?? null},
      ${data.accessValidUntil ?? null}
    )
    RETURNING *
  `
  return rowToBooking(rows[0])
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM bookings WHERE id = ${id} LIMIT 1`
  return rows[0] ? rowToBooking(rows[0]) : null
}

export async function getBookingsByUser(userId: string): Promise<Booking[]> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM bookings WHERE user_id = ${userId} ORDER BY created_at DESC`
  return rows.map(rowToBooking)
}

export async function listBookings(): Promise<Booking[]> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM bookings ORDER BY created_at DESC`
  return rows.map(rowToBooking)
}

export async function updateBookingStatus(id: string, status: Booking['status']): Promise<void> {
  const sql = getDb()
  await sql`UPDATE bookings SET status = ${status} WHERE id = ${id}`
}

export async function patchBookingAdmin(
  id: string,
  next: Booking,
  accessValidUntil: string,
): Promise<Booking | null> {
  const sql = getDb()
  const rows = await sql`
    UPDATE bookings SET
      date         = ${next.date}::date,
      start_time   = ${next.start}::time,
      end_time     = ${next.end}::time,
      room         = ${next.room},
      people       = ${next.people},
      total_chips  = ${next.totalChips},
      status       = ${next.status},
      access_valid_until = ${accessValidUntil}
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ? rowToBooking(rows[0]) : null
}

export async function extendBooking(id: string, newEnd: string, chipsCost: number): Promise<Booking | null> {
  const sql = getDb()
  const current = await getBookingById(id)
  const accessValidUntil = current
    ? bookingAccessUntilIso(current.date, current.start, newEnd)
    : null
  const rows = await sql`
    UPDATE bookings
    SET end_time = ${newEnd}::time,
        access_valid_until = ${accessValidUntil},
        total_chips = total_chips + ${chipsCost}
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ? rowToBooking(rows[0]) : null
}

export async function hasBookingConflictNeon(
  date: string,
  start: string,
  end: string,
  ignoreId?: string,
): Promise<boolean> {
  const sql = getDb()
  // Compare timestamp intervals, including slots that cross midnight.
  const rows = await sql`
    WITH candidate AS (
      SELECT
        (${date}::date + ${start}::time) AS start_ts,
        CASE
          WHEN ${end}::time <= ${start}::time
            THEN (${date}::date + ${end}::time + INTERVAL '1 day')
          ELSE (${date}::date + ${end}::time)
        END AS end_ts
    )
    SELECT b.id
    FROM bookings b
    CROSS JOIN candidate c
    WHERE b.date BETWEEN (${date}::date - INTERVAL '1 day') AND (${date}::date + INTERVAL '1 day')
      AND b.status NOT IN ('cancelled')
      AND b.id != ${ignoreId ?? ''}
      AND c.start_ts < CASE
        WHEN b.end_time <= b.start_time
          THEN (b.date + b.end_time + INTERVAL '1 day')
        ELSE (b.date + b.end_time)
      END
      AND c.end_ts > (b.date + b.start_time)
    LIMIT 1
  `
  if (rows.length) return true

  const blocked = await sql`
    WITH candidate AS (
      SELECT
        (${date}::date + ${start}::time) AS start_ts,
        CASE
          WHEN ${end}::time <= ${start}::time
            THEN (${date}::date + ${end}::time + INTERVAL '1 day')
          ELSE (${date}::date + ${end}::time)
        END AS end_ts
    )
    SELECT s.id
    FROM blocked_slots s
    CROSS JOIN candidate c
    WHERE s.date BETWEEN (${date}::date - INTERVAL '1 day') AND (${date}::date + INTERVAL '1 day')
      AND c.start_ts < CASE
        WHEN s.end_time <= s.start_time
          THEN (s.date + s.end_time + INTERVAL '1 day')
        ELSE (s.date + s.end_time)
      END
      AND c.end_ts > (s.date + s.start_time)
    LIMIT 1
  `
  return blocked.length > 0
}

// ── ADDONS ────────────────────────────────────────────────────────────────────

function rowToAddon(r: Record<string, unknown>): Addon {
  const soldDate = r.sold_today_date
    ? new Date(r.sold_today_date as string).toISOString().slice(0, 10)
    : ''
  const today = new Date().toISOString().slice(0, 10)
  return {
    id:          String(r.id),
    category:    (r.category as Addon['category']) ?? 'modes',
    brand:       String(r.brand ?? 'ROOMIE'),
    name:        String(r.name ?? ''),
    description: String(r.description ?? ''),
    price:       Number(r.price ?? 0),
    status:      (r.status as Addon['status']) ?? 'active',
    soldToday:   soldDate && soldDate !== today ? 0 : Number(r.sold_today ?? 0),
  }
}

export async function resetAddonCountersIfNeeded(): Promise<void> {
  const sql = getDb()
  await sql`
    UPDATE addons
    SET sold_today = 0,
        sold_today_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE sold_today_date < CURRENT_DATE
  `
}

export async function listAddons(includeHidden = false): Promise<Addon[]> {
  await ensureBootstrapData()
  await resetAddonCountersIfNeeded()
  const sql = getDb()
  const rows = includeHidden
    ? await sql`SELECT * FROM addons WHERE status != 'deleted' ORDER BY sort_order, created_at`
    : await sql`SELECT * FROM addons WHERE status = 'active' ORDER BY sort_order, created_at`
  return rows.map(rowToAddon)
}

export async function createAddon(data: Partial<Addon>): Promise<Addon> {
  const sql = getDb()
  const id = data.id ?? data.name?.toLowerCase().replace(/\s+/g, '-') ?? String(Date.now())
  const rows = await sql`
    INSERT INTO addons (id, category, brand, name, description, price, status)
    VALUES (
      ${id},
      ${data.category ?? 'modes'},
      ${data.brand ?? 'ROOMIE'},
      ${data.name ?? ''},
      ${data.description ?? ''},
      ${data.price ?? 0},
      ${data.status ?? 'active'}
    )
    RETURNING *
  `
  return rowToAddon(rows[0])
}

export async function patchAddon(id: string, data: Partial<Addon>): Promise<Addon | null> {
  const sql = getDb()
  const rows = await sql`
    UPDATE addons SET
      category    = COALESCE(${data.category    ?? null}, category),
      brand       = COALESCE(${data.brand       ?? null}, brand),
      name        = COALESCE(${data.name        ?? null}, name),
      description = COALESCE(${data.description ?? null}, description),
      price       = COALESCE(${data.price       ?? null}, price),
      status      = COALESCE(${data.status      ?? null}, status),
      updated_at  = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ? rowToAddon(rows[0]) : null
}

// ── ADDON ORDERS ──────────────────────────────────────────────────────────────

export async function createAddonOrder(data: {
  id: string
  userId: string
  bookingId: string
  totalChips: number
  items: AddonOrder['items']
}): Promise<void> {
  const sql = getDb()
  await sql`
    INSERT INTO addon_orders (id, user_id, booking_id, total_chips)
    VALUES (${data.id}, ${data.userId}, ${data.bookingId}, ${data.totalChips})
  `
  for (const item of data.items) {
    await sql`
      INSERT INTO addon_order_items (order_id, addon_id, name, brand, unit_price, qty, total)
      VALUES (${data.id}, ${item.id}, ${item.name}, ${item.brand}, ${item.price}, ${item.qty}, ${item.total})
    `
    await sql`
      UPDATE addons
      SET sold_today = CASE
            WHEN sold_today_date = CURRENT_DATE THEN sold_today + ${item.qty}
            ELSE ${item.qty}
          END,
          sold_today_date = CURRENT_DATE,
          updated_at = NOW()
      WHERE id = ${item.id}
    `
  }
}

// ── BLOCKED SLOTS ─────────────────────────────────────────────────────────────

function rowToBlockedSlot(r: Record<string, unknown>): BlockedSlot {
  return {
    id:        String(r.id),
    date:      r.date ? new Date(r.date as string).toISOString().slice(0, 10) : '',
    start:     String(r.start_time ?? '').slice(0, 5),
    end:       String(r.end_time ?? '').slice(0, 5),
    reason:    String(r.reason ?? ''),
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
  }
}

export async function listBlockedSlots(): Promise<BlockedSlot[]> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM blocked_slots ORDER BY date, start_time`
  return rows.map(rowToBlockedSlot)
}

export async function createBlockedSlot(data: {
  id: string
  date: string
  start: string
  end: string
  reason: string
  createdBy?: string
}): Promise<BlockedSlot> {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO blocked_slots (id, date, start_time, end_time, reason, created_by)
    VALUES (
      ${data.id},
      ${data.date}::date,
      ${data.start}::time,
      ${data.end}::time,
      ${data.reason},
      ${data.createdBy ?? null}
    )
    RETURNING *
  `
  return rowToBlockedSlot(rows[0])
}

export async function deleteBlockedSlot(id: string): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM blocked_slots WHERE id = ${id}`
}

// ── ACCESS LOGS ───────────────────────────────────────────────────────────────

export type AccessEvent =
  | 'lockbox_viewed' | 'lockbox_copied'
  | 'shutter_done'   | 'key_replaced'
  | 'door_nfc'       | 'door_code'    | 'door_opened'
  | 'session_started'| 'session_ended'

export async function logAccess(data: {
  bookingId?: string
  userId?: string
  event: AccessEvent
  method?: string
  ip?: string
  userAgent?: string
}): Promise<void> {
  const sql = getDb()
  await sql`
    INSERT INTO access_logs (booking_id, user_id, event, method, ip, user_agent)
    VALUES (
      ${data.bookingId ?? null},
      ${data.userId    ?? null},
      ${data.event},
      ${data.method    ?? null},
      ${data.ip        ?? null},
      ${data.userAgent ?? null}
    )
  `
}

export async function listAccessLogs(limit = 100): Promise<AuditEntry[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, user_id, event AS type, booking_id, method, ip, created_at
    FROM access_logs
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows.map(r => ({
    id:        String(r.id),
    type:      String(r.type),
    userId:    String(r.user_id ?? ''),
    details:   { bookingId: r.booking_id, method: r.method, ip: r.ip },
    createdAt: new Date(r.created_at as string).toISOString(),
  }))
}

// ── STRIPE SESSIONS ───────────────────────────────────────────────────────────

export async function createStripeSession(data: {
  id: string
  userId: string
  amountChips: number
  amountEur: number
}): Promise<void> {
  const sql = getDb()
  await sql`
    INSERT INTO stripe_sessions (id, user_id, amount_chips, amount_eur)
    VALUES (${data.id}, ${data.userId}, ${data.amountChips}, ${data.amountEur})
    ON CONFLICT (id) DO NOTHING
  `
}

export async function completeStripeSession(
  sessionId: string,
  paymentIntent: string,
): Promise<{ userId: string; amountChips: number } | null> {
  const sql = getDb()
  const rows = await sql`
    UPDATE stripe_sessions
    SET status = 'paid', payment_intent = ${paymentIntent}, paid_at = NOW()
    WHERE id = ${sessionId} AND status = 'pending'
    RETURNING user_id, amount_chips
  `
  if (!rows[0]) return null
  return { userId: String(rows[0].user_id), amountChips: Number(rows[0].amount_chips) }
}

export async function markStripeSessionAlready(sessionId: string): Promise<void> {
  const sql = getDb()
  await sql`UPDATE stripe_sessions SET status = 'already' WHERE id = ${sessionId}`
}

// ── AUDIT LOG (fire-and-forget) ───────────────────────────────────────────────

export async function logEvent(
  type: string,
  userId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await ensureBootstrapData()
  const sql = getDb()
  try {
    await sql`
      INSERT INTO audit_log (id, type, user_id, details)
      VALUES (gen_random_uuid(), ${type}, ${userId}, ${JSON.stringify(details)}::jsonb)
    `
  } catch (err) {
    console.error('[audit] failed to persist event:', err)
  }
}

export async function isRateLimited(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<boolean> {
  await ensureBootstrapData()
  const sql = getDb()
  await sql`DELETE FROM rate_limits WHERE expires_at <= NOW()`
  const rows = await sql`
    INSERT INTO rate_limits (key, count, expires_at, updated_at)
    VALUES (
      ${key},
      1,
      NOW() + (${windowMs} || ' milliseconds')::interval,
      NOW()
    )
    ON CONFLICT (key) DO UPDATE
    SET
      count = CASE WHEN rate_limits.expires_at <= NOW() THEN 1 ELSE rate_limits.count + 1 END,
      expires_at = CASE WHEN rate_limits.expires_at <= NOW() THEN NOW() + (${windowMs} || ' milliseconds')::interval ELSE rate_limits.expires_at END,
      updated_at = NOW()
    RETURNING count
  `
  return Number(rows[0]?.count ?? 0) > maxAttempts
}

export async function clearRateLimit(key: string): Promise<void> {
  await ensureBootstrapData()
  const sql = getDb()
  await sql`DELETE FROM rate_limits WHERE key = ${key}`
}

// ── GOOGLE UPSERT ─────────────────────────────────────────────────────────────

async function uniqueUsernameNeon(seed: string): Promise<string> {
  const sql = getDb()
  let username = seed
  let suffix = 1
  while (suffix <= 50) {
    const rows = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`
    if (!rows.length) return username
    const trimmed = seed.slice(0, Math.max(3, 20 - String(suffix).length - 1))
    username = `${trimmed}_${suffix}`
    suffix += 1
  }
  const { randomUUID } = await import('crypto')
  return `roomie_${randomUUID().replace(/-/g, '').slice(0, 12)}`
}

// ── CLERK INTEGRATION ─────────────────────────────────────────────────────────

interface ClerkUserProfile {
  id: string
  emailAddresses: Array<{ id?: string; emailAddress: string }>
  primaryEmailAddressId?: string | null
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  imageUrl?: string
  unsafeMetadata?: {
    roomieUsername?: unknown
    roomieDisplayName?: unknown
    acceptedTerms?: unknown
    acceptedPrivacy?: unknown
  } | null
}

export async function getUserByClerkId(clerkId: string): Promise<DbUser | null> {
  await ensureBootstrapData()
  const sql = getDb()
  const rows = await sql`SELECT * FROM users WHERE clerk_id = ${clerkId} LIMIT 1`
  return rows[0] ? rowToDbUser(rows[0]) : null
}

async function linkClerkId(userId: string, clerkId: string): Promise<void> {
  const sql = getDb()
  await sql`UPDATE users SET clerk_id = ${clerkId}, updated_at = NOW() WHERE id = ${userId}`
}

export async function getOrCreateRoomieUserFromClerk(profile: ClerkUserProfile): Promise<DbUser | null> {
  const { randomUUID } = await import('crypto')
  const clerkId = profile.id
  if (!clerkId) return null

  const primaryEmail = (
    profile.emailAddresses.find(address => address.id === profile.primaryEmailAddressId) ??
    profile.emailAddresses[0]
  )?.emailAddress ?? ''
  const email = normalizeEmail(primaryEmail)

  // 1. Fast path: already linked
  let user = await getUserByClerkId(clerkId)
  if (user) {
    if (email && isValidEmailString(email) && email !== user.email) {
      const sql = getDb()
      await sql`UPDATE users SET email = ${email}, updated_at = NOW() WHERE id = ${user.id}`
      user = { ...user, email }
    }
    return user
  }

  // 2. Link to existing ROOMIE account by email
  if (isValidEmailString(email)) {
    user = await getUserByEmail(email)
    if (user) {
      await linkClerkId(user.id, clerkId)
      if (profile.unsafeMetadata?.acceptedTerms === true || profile.unsafeMetadata?.acceptedPrivacy === true) {
        user = await acceptUserLegal(user.id) ?? user
      }
      return user
    }
  }

  // 3. Create new user
  if (!isValidEmailString(email)) return null

  const metadataName = typeof profile.unsafeMetadata?.roomieDisplayName === 'string'
    ? profile.unsafeMetadata.roomieDisplayName.trim()
    : ''
  const nameParts = [profile.firstName, profile.lastName].filter(Boolean)
  const name = metadataName || (nameParts.length > 0 ? nameParts.join(' ').trim() : email.split('@')[0])
  const metadataUsername = typeof profile.unsafeMetadata?.roomieUsername === 'string'
    ? profile.unsafeMetadata.roomieUsername.trim()
    : ''
  const rawBase = (metadataUsername || profile.username || email.split('@')[0]).replace(/[^a-z0-9_]/g, '_').toLowerCase()
  const base = rawBase.slice(0, 16) || 'user'
  const seed = base.length >= 3 ? base : `${base}_user`
  const username = await uniqueUsernameNeon(seed)

  user = await createUser({
    id: randomUUID(),
    username,
    email,
    name: String(name).trim() || 'ROOMIE User',
    chips: 24,
    avatar: profile.imageUrl,
  })

  await linkClerkId(user.id, clerkId)
  if (profile.unsafeMetadata?.acceptedTerms === true || profile.unsafeMetadata?.acceptedPrivacy === true) {
    user = await acceptUserLegal(user.id) ?? user
  }
  await logEvent('clerk_register', user.id, { clerkId, email })
  return user
}

export async function upsertGoogleUserFromProfile(profile: {
  email?: string
  sub?: string
  name?: string
  picture?: string
}): Promise<DbUser | null> {
  const { randomUUID } = await import('crypto')
  const email = normalizeEmail(profile.email)
  const providerId = typeof profile.sub === 'string' ? profile.sub.trim() : ''
  if (!isValidEmailString(email) || !providerId) return null

  let user: DbUser | null = await getUserByProvider('google', providerId)
  if (!user) user = await getUserByEmail(email)

  if (!user) {
    // New user — pick a unique username from email
    const base = email.split('@')[0].replace(/[^a-z0-9_]/g, '_').toLowerCase().slice(0, 16) || 'roomie'
    const seed = base.length >= 3 ? base : `${base}_user`
    const username = await uniqueUsernameNeon(seed)
    user = await createUser({
      id: randomUUID(),
      username,
      email,
      name: String(profile.name || email.split('@')[0]).trim(),
      chips: 24,
      provider: 'google',
      providerId,
      avatar: profile.picture || undefined,
    })
    await logEvent('social_register', user.id, { provider: 'google', email })
  }

  return user
}

// ── STRIPE CREDIT (high-level) ────────────────────────────────────────────────

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
  if (!sessionId || !userId || !Number.isInteger(amount) || amount <= 0 || amount > 500) {
    return { credited: false, reason: 'BAD_METADATA' }
  }

  await createStripeSession({
    id: sessionId,
    userId,
    amountChips: amount,
    amountEur: amount,
  })

  const sql = getDb()

  // ── Atomic CTE: mark session paid + credit chips + record wallet tx ────────
  // stripe_sessions.status = 'pending' is the idempotency guard.
  // If already 'paid', session_update returns 0 rows → whole CTE is a no-op.
  const rows = await sql`
    WITH
      session_update AS (
        UPDATE stripe_sessions
        SET status = 'paid',
            payment_intent = ${String(session.payment_intent || '')},
            paid_at = NOW()
        WHERE id = ${sessionId} AND status = 'pending'
        RETURNING user_id, amount_chips
      ),
      chip_credit AS (
        UPDATE users
        SET chips = chips + (SELECT amount_chips FROM session_update)
        WHERE id = (SELECT user_id FROM session_update)
        RETURNING id AS user_id, chips
      ),
      _tx AS (
        INSERT INTO wallet_transactions (user_id, type, chips_delta, chips_after, ref_id, note)
        SELECT s.user_id, 'topup', s.amount_chips, c.chips, ${sessionId}, 'stripe_topup'
        FROM session_update s
        JOIN chip_credit c ON c.user_id = s.user_id
      )
    SELECT s.user_id, s.amount_chips, c.chips AS new_chips
    FROM session_update s
    JOIN chip_credit c ON c.user_id = s.user_id
  `

  if (!rows[0]) return { credited: false, reason: 'ALREADY_CREDITED' }

  const creditedUserId = String(rows[0].user_id)
  const creditedAmount = Number(rows[0].amount_chips)

  await logEvent('stripe_wallet_topup', creditedUserId, { amount: creditedAmount, sessionId })

  const user = await getUserById(creditedUserId)
  return { credited: true, user: user ? publicUser(user) : null, amount: creditedAmount }
}

// ── ATOMIC OPERATIONS ─────────────────────────────────────────────────────────
// The neon HTTP driver does NOT support async callbacks in .transaction().
// All atomic operations use a single CTE query (data-modifying CTEs in PostgreSQL
// are atomic — all DML executes within one implicit transaction).
//
// Pattern: chip deduct (with balance check) + wallet record + main insert, in one query.
// If balance is insufficient, chip_deduct returns 0 rows → downstream CTEs are skipped
// → outer SELECT returns 0 rows → caller checks and throws 'INSUFFICIENT_CHIPS'.

type BookingInput = Parameters<typeof createBooking>[0]

export async function createBookingAtomic(
  userId: string,
  bookingData: BookingInput,
  totalChips: number,
  note: string,
): Promise<{ booking: Booking; newChips: number }> {
  const sql = getDb()
  const d = bookingData
  const rows = await sql`
    WITH
      slot_locks AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            CONCAT(${d.room ?? 'Via Terni'}::text, ':', lock_date::date::text),
            0
          )
        )
        FROM generate_series(
          ${d.date}::date - INTERVAL '1 day',
          ${d.date}::date + INTERVAL '1 day',
          INTERVAL '1 day'
        ) AS dates(lock_date)
        ORDER BY lock_date
      ),
      candidate AS (
        SELECT
          (${d.date}::date + ${d.start}::time) AS start_ts,
          CASE
            WHEN ${d.end}::time <= ${d.start}::time
              THEN (${d.date}::date + ${d.end}::time + INTERVAL '1 day')
            ELSE (${d.date}::date + ${d.end}::time)
          END AS end_ts
      ),
      booking_conflict AS (
        SELECT b.id
        FROM bookings b
        CROSS JOIN candidate c
        WHERE b.date BETWEEN (${d.date}::date - INTERVAL '1 day') AND (${d.date}::date + INTERVAL '1 day')
          AND b.status NOT IN ('cancelled')
          AND c.start_ts < CASE
            WHEN b.end_time <= b.start_time
              THEN (b.date + b.end_time + INTERVAL '1 day')
            ELSE (b.date + b.end_time)
          END
          AND c.end_ts > (b.date + b.start_time)
        LIMIT 1
      ),
      blocked_conflict AS (
        SELECT s.id
        FROM blocked_slots s
        CROSS JOIN candidate c
        WHERE s.date BETWEEN (${d.date}::date - INTERVAL '1 day') AND (${d.date}::date + INTERVAL '1 day')
          AND c.start_ts < CASE
            WHEN s.end_time <= s.start_time
              THEN (s.date + s.end_time + INTERVAL '1 day')
            ELSE (s.date + s.end_time)
          END
          AND c.end_ts > (s.date + s.start_time)
        LIMIT 1
      ),
      availability AS (
        SELECT
          NOT EXISTS (SELECT 1 FROM booking_conflict)
          AND NOT EXISTS (SELECT 1 FROM blocked_conflict) AS slot_ok
        FROM slot_locks
        LIMIT 1
      ),
      chip_deduct AS (
        UPDATE users
        SET chips = chips - ${totalChips}
        WHERE id = ${userId}
          AND chips >= ${totalChips}
          AND (SELECT slot_ok FROM availability)
        RETURNING chips
      ),
      _tx AS (
        INSERT INTO wallet_transactions (user_id, type, chips_delta, chips_after, ref_id, note)
        SELECT ${userId}, 'booking_debit', ${-totalChips}, c.chips, ${d.id}, ${note}
        FROM chip_deduct c
      ),
      bk AS (
        INSERT INTO bookings (
          id, user_id, room, date, start_time, end_time, people,
          preset, duration_hours, guests, total_chips, live_mode,
          lockbox_code, door_code, access_valid_from, access_valid_until
        )
        SELECT
          ${d.id}, ${d.userId}, ${d.room ?? 'Via Terni'},
          ${d.date}::date, ${d.start}::time, ${d.end}::time,
          ${d.people}, ${d.preset}, ${d.durationHours}, ${d.guests}, ${d.totalChips},
          ${d.liveMode ?? false},
          ${d.lockboxCode ?? null}::text, ${d.doorCode ?? null}::text,
          ${d.accessValidFrom ?? null}::timestamptz, ${d.accessValidUntil ?? null}::timestamptz
        WHERE EXISTS (SELECT 1 FROM chip_deduct)
        RETURNING *
      )
    SELECT (SELECT chips FROM chip_deduct) AS new_chips, bk.*
    FROM bk
  `
  if (!rows[0]) {
    if (await hasBookingConflictNeon(d.date, d.start, d.end)) throw new Error('SLOT_BLOCKED')
    throw new Error('INSUFFICIENT_CHIPS')
  }
  return {
    booking: rowToBooking(rows[0]),
    newChips: Number(rows[0].new_chips),
  }
}

export type AddonOrderItem = {
  id: string; name: string; brand: string; price: number; qty: number; total: number
}

export async function createAddonOrderAtomic(
  userId: string,
  orderId: string,
  bookingId: string,
  items: AddonOrderItem[],
  totalChips: number,
): Promise<{ newChips: number }> {
  const sql = getDb()
  const note = `addon_order:${bookingId}`
  const itemsJson = JSON.stringify(items)

  // Atomic: chip deduct + wallet record + order header + items + sold_today.
  const rows = await sql`
    WITH
      input_items AS (
        SELECT *
        FROM jsonb_to_recordset(${itemsJson}::jsonb) AS item(
          id text,
          name text,
          brand text,
          price integer,
          qty integer,
          total integer
        )
      ),
      chip_deduct AS (
        UPDATE users
        SET chips = chips - ${totalChips}
        WHERE id = ${userId} AND chips >= ${totalChips}
        RETURNING chips
      ),
      _tx AS (
        INSERT INTO wallet_transactions (user_id, type, chips_delta, chips_after, ref_id, note)
        SELECT ${userId}, 'addon_debit', ${-totalChips}, c.chips, ${orderId}, ${note}
        FROM chip_deduct c
      ),
      _order AS (
        INSERT INTO addon_orders (id, user_id, booking_id, total_chips)
        SELECT ${orderId}, ${userId}, ${bookingId}, ${totalChips}
        WHERE EXISTS (SELECT 1 FROM chip_deduct)
      ),
      _items AS (
        INSERT INTO addon_order_items (order_id, addon_id, name, brand, unit_price, qty, total)
        SELECT ${orderId}, id, name, brand, price, qty, total
        FROM input_items
        WHERE EXISTS (SELECT 1 FROM chip_deduct)
      ),
      _sold AS (
        UPDATE addons a
        SET sold_today = CASE
              WHEN a.sold_today_date = CURRENT_DATE THEN a.sold_today + i.qty
              ELSE i.qty
            END,
            sold_today_date = CURRENT_DATE,
            updated_at = NOW()
        FROM input_items i
        WHERE a.id = i.id
          AND EXISTS (SELECT 1 FROM chip_deduct)
      )
    SELECT chips AS new_chips FROM chip_deduct
  `
  if (!rows[0]) throw new Error('INSUFFICIENT_CHIPS')
  return { newChips: Number(rows[0].new_chips) }
}

export async function listAddonOrders(limit = 80): Promise<AddonOrder[]> {
  const sql = getDb()
  const orders = await sql`
    SELECT * FROM addon_orders
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  const ids = orders.map(r => String(r.id))
  if (!ids.length) return []
  const items = await sql`
    SELECT * FROM addon_order_items
    WHERE order_id = ANY(${ids})
    ORDER BY order_id, name
  `
  const itemsByOrder = new Map<string, AddonOrder['items']>()
  for (const item of items) {
    const orderId = String(item.order_id)
    const list = itemsByOrder.get(orderId) || []
    list.push({
      id: String(item.addon_id),
      name: String(item.name),
      brand: String(item.brand || 'ROOMIE'),
      price: Number(item.unit_price || 0),
      qty: Number(item.qty || 1),
      total: Number(item.total || 0),
    })
    itemsByOrder.set(orderId, list)
  }
  return orders.map(r => ({
    id: String(r.id),
    userId: String(r.user_id),
    bookingId: String(r.booking_id),
    items: itemsByOrder.get(String(r.id)) || [],
    totalChips: Number(r.total_chips || 0),
    status: String(r.status || 'paid') as AddonOrder['status'],
    createdAt: new Date(r.created_at as string).toISOString(),
  }))
}

export async function extendBookingAtomic(
  userId: string,
  bookingId: string,
  oldEnd: string,
  newEnd: string,
  price: number,
  accessValidUntil: string,
): Promise<{ booking: Booking; newChips: number }> {
  const sql = getDb()
  const extNote = `extend:${oldEnd}->${newEnd}`
  const rows = await sql`
    WITH
      chip_deduct AS (
        UPDATE users
        SET chips = chips - ${price}
        WHERE id = ${userId} AND chips >= ${price}
        RETURNING chips
      ),
      _tx AS (
        INSERT INTO wallet_transactions (user_id, type, chips_delta, chips_after, ref_id, note)
        SELECT ${userId}, 'booking_debit', ${-price}, c.chips, ${bookingId}, ${extNote}
        FROM chip_deduct c
      ),
      bk AS (
        UPDATE bookings
        SET end_time = ${newEnd}::time,
            access_valid_until = ${accessValidUntil},
            total_chips = total_chips + ${price}
        WHERE id = ${bookingId} AND EXISTS (SELECT 1 FROM chip_deduct)
        RETURNING *
      )
    SELECT (SELECT chips FROM chip_deduct) AS new_chips, bk.*
    FROM bk
  `
  if (!rows[0]) throw new Error('INSUFFICIENT_CHIPS')
  return {
    booking: rowToBooking(rows[0]),
    newChips: Number(rows[0].new_chips),
  }
}

// ── ADMIN SUMMARY ─────────────────────────────────────────────────────────────

export async function adminSummary() {
  await ensureBootstrapData()
  const sql = getDb()
  const [users, bookings, addons, blockedSlots, accessLogs, auditLogs, addonOrders] = await Promise.all([
    sql`SELECT * FROM users ORDER BY created_at DESC`,
    sql`SELECT * FROM bookings ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT * FROM addons WHERE status != 'deleted' ORDER BY sort_order`,
    sql`SELECT * FROM blocked_slots ORDER BY date, start_time`,
    sql`SELECT * FROM access_logs ORDER BY created_at DESC LIMIT 50`,
    sql`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 80`,
    listAddonOrders(80),
  ])
  const config = await getConfig()

  return {
    config,
    users: users.map(rowToDbUser),
    bookings: bookings.map(rowToBooking),
    addons: addons.map(rowToAddon),
    blockedSlots: blockedSlots.map(rowToBlockedSlot),
    recentAccess: accessLogs.map(r => ({
      id:        String(r.id),
      type:      String(r.event),
      userId:    String(r.user_id ?? ''),
      details:   { bookingId: r.booking_id, method: r.method },
      createdAt: new Date(r.created_at as string).toISOString(),
    })),
    auditLog: auditLogs.map(r => ({
      id:        String(r.id),
      type:      String(r.type),
      userId:    String(r.user_id ?? ''),
      details:   (r.details && typeof r.details === 'object') ? r.details as Record<string, unknown> : {},
      createdAt: new Date(r.created_at as string).toISOString(),
    })),
    addonOrders,
  }
}
