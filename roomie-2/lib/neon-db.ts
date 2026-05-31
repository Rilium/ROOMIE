// ── lib/neon-db.ts ────────────────────────────────────────────────────────────
// Relational DB layer for ROOMIE — Neon PostgreSQL.
// Replaces the JSON-blob lib/db.ts once schema is migrated.
//
// Usage: swap imports in API routes from '@/lib/db' to '@/lib/neon-db'.
// Run db/001_initial_schema.sql first against your Neon database.

import { neon } from '@neondatabase/serverless'
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

// ── CONNECTION ────────────────────────────────────────────────────────────────

function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return neon(url)
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
  }
}

// ── CONFIG ────────────────────────────────────────────────────────────────────

export async function getConfig(): Promise<AppConfig> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM config WHERE id = 1`
  const row = rows[0]
  if (!row) return { hourlyPrice: 12, dayPrice: 60, guestPassPrice: 2, maxPeople: 8, lockboxCode: '4729' }
  return {
    hourlyPrice:    Number(row.hourly_price),
    dayPrice:       Number(row.day_price),
    guestPassPrice: Number(row.guest_pass_price),
    maxPeople:      Number(row.max_people),
    lockboxCode:    String(row.lockbox_code),
  }
}

export async function patchConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
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
    createdAt:    r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
  }
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function getUserByUsername(username: string): Promise<DbUser | null> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const sql = getDb()
  const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`
  return rows[0] ? rowToDbUser(rows[0]) : null
}

export async function getUserByProvider(provider: string, providerId: string): Promise<DbUser | null> {
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

export async function extendBooking(id: string, newEnd: string, chipsCost: number): Promise<Booking | null> {
  const sql = getDb()
  const rows = await sql`
    UPDATE bookings
    SET end_time = ${newEnd}::time,
        access_valid_until = (date + ${newEnd}::time)::timestamptz,
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
  // Check bookings that overlap: (start < b.end_time) AND (end > b.start_time)
  const rows = await sql`
    SELECT id FROM bookings
    WHERE date = ${date}::date
      AND status NOT IN ('cancelled')
      AND ${start}::time < end_time
      AND ${end}::time > start_time
      AND id != ${ignoreId ?? ''}
    LIMIT 1
  `
  if (rows.length) return true

  // Also check blocked_slots
  const blocked = await sql`
    SELECT id FROM blocked_slots
    WHERE date = ${date}::date
      AND ${start}::time < end_time
      AND ${end}::time > start_time
    LIMIT 1
  `
  return blocked.length > 0
}

// ── ADDONS ────────────────────────────────────────────────────────────────────

function rowToAddon(r: Record<string, unknown>): Addon {
  return {
    id:          String(r.id),
    category:    (r.category as Addon['category']) ?? 'modes',
    brand:       String(r.brand ?? 'ROOMIE'),
    name:        String(r.name ?? ''),
    description: String(r.description ?? ''),
    price:       Number(r.price ?? 0),
    status:      (r.status as Addon['status']) ?? 'active',
    soldToday:   Number(r.sold_today ?? 0),
  }
}

export async function listAddons(includeHidden = false): Promise<Addon[]> {
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
      UPDATE addons SET sold_today = sold_today + ${item.qty} WHERE id = ${item.id}
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

type AccessEvent =
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
  try {
    const sql = getDb()
    // Use access_logs table if event maps to it, otherwise just console.log
    console.log('[audit]', type, userId, details)
    // Try to insert into audit_log if the table exists (created by optional migration)
    await sql`
      INSERT INTO audit_log (id, type, user_id, details)
      VALUES (gen_random_uuid(), ${type}, ${userId}, ${JSON.stringify(details)}::jsonb)
    `.catch(() => { /* table may not exist yet — silent */ })
  } catch {
    // Never throw from logEvent
  }
}

// ── GOOGLE UPSERT ─────────────────────────────────────────────────────────────

async function uniqueUsernameNeon(seed: string): Promise<string> {
  const sql = getDb()
  let username = seed
  let suffix = 1
  while (true) {
    const rows = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`
    if (!rows.length) return username
    const trimmed = seed.slice(0, Math.max(3, 20 - String(suffix).length - 1))
    username = `${trimmed}_${suffix}`
    suffix += 1
  }
}

export async function upsertGoogleUserFromProfile(profile: {
  email?: string
  sub?: string
  name?: string
  picture?: string
}): Promise<DbUser | null> {
  const { randomUUID } = await import('crypto')
  const email = String(profile.email || '').trim().toLowerCase()
  if (!email) return null

  // Try provider match first, then email
  let user: DbUser | null = null
  if (profile.sub) {
    user = await getUserByProvider('google', String(profile.sub))
  }
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
      providerId: String(profile.sub || ''),
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

  const result = await completeStripeSession(sessionId, String(session.payment_intent || ''))
  if (!result) return { credited: false, reason: 'ALREADY_CREDITED' }

  const newChips = await adjustUserChips(result.userId, result.amountChips)
  await recordTransaction({
    userId: result.userId,
    type: 'topup',
    chipsDelta: result.amountChips,
    chipsAfter: newChips,
    refId: sessionId,
    note: 'stripe_topup',
  })
  await logEvent('stripe_wallet_topup', result.userId, { amount: result.amountChips, sessionId })

  const user = await getUserById(result.userId)
  return { credited: true, user: user ? publicUser(user) : null, amount: result.amountChips }
}

// ── ADMIN SUMMARY ─────────────────────────────────────────────────────────────

export async function adminSummary() {
  const sql = getDb()
  const [users, bookings, addons, blockedSlots, accessLogs] = await Promise.all([
    sql`SELECT * FROM users ORDER BY created_at DESC`,
    sql`SELECT * FROM bookings ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT * FROM addons WHERE status != 'deleted' ORDER BY sort_order`,
    sql`SELECT * FROM blocked_slots ORDER BY date, start_time`,
    sql`SELECT * FROM access_logs ORDER BY created_at DESC LIMIT 50`,
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
  }
}
