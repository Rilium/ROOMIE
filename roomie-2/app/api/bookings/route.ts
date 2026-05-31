import { randomUUID } from 'crypto'
import {
  getBookingsByUser,
  listBookings,
  createBooking,
  adjustUserChips,
  recordTransaction,
  hasBookingConflictNeon,
  logEvent,
  getConfig,
  publicUser,
} from '@/lib/neon-db'
import { requireAuth, storageGuard } from '@/lib/api-helpers'
import { calcBookingPrice, serializeBooking, ACTIVE_STATUSES } from '@/lib/utils'

export async function GET(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const bookings = user.role === 'admin'
    ? await listBookings()
    : await getBookingsByUser(user.id)

  return Response.json({ bookings: bookings.map(serializeBooking) })
}

// ── Validate HH:MM time string ─────────────────────────────────────────────
function isValidTime(t: unknown): t is string {
  return typeof t === 'string' && /^\d{2}:\d{2}$/.test(t)
}

export async function POST(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  // ── Validate time/date ────────────────────────────────────────────────────
  const date = body.date as string
  const start = body.start as string
  const end = body.end as string
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return Response.json({ error: 'BAD_BOOKING_DATE' }, { status: 400 })
  }
  if (!isValidTime(start) || !isValidTime(end)) {
    return Response.json({ error: 'BAD_BOOKING_TIME' }, { status: 400 })
  }

  // ── Validate people ────────────────────────────────────────────────────────
  const cfg = await getConfig()
  const people = Math.max(1, Number(body.people || 1))
  const maxPeople = Number(cfg.maxPeople || 8)
  if (!Number.isInteger(people) || people < 1 || people > maxPeople) {
    return Response.json({ error: 'BAD_PEOPLE', max: maxPeople }, { status: 400 })
  }

  // ── Server-side price (client value is IGNORED) ────────────────────────────
  const preset = typeof body.preset === 'string' ? body.preset : 'ranked'
  const duration = Math.max(1, Number(body.duration || 2))
  const guests = Math.max(0, Number(body.guests || 0))
  const totalChips = calcBookingPrice(preset, duration, guests, cfg)

  // ── Conflict check ────────────────────────────────────────────────────────
  if (await hasBookingConflictNeon(date, start, end)) {
    return Response.json({ error: 'SLOT_BLOCKED' }, { status: 409 })
  }

  // ── Balance check ─────────────────────────────────────────────────────────
  if (user.chips < totalChips) {
    return Response.json(
      { error: 'INSUFFICIENT_CHIPS', chips: user.chips, required: totalChips },
      { status: 402 },
    )
  }

  // ── Debit chips ───────────────────────────────────────────────────────────
  const id = randomUUID()
  const newChips = await adjustUserChips(user.id, -totalChips)
  await recordTransaction({
    userId: user.id,
    type: 'booking_debit',
    chipsDelta: -totalChips,
    chipsAfter: newChips,
    refId: id,
    note: `booking:${preset}:${date}`,
  })

  const booking = await createBooking({
    id,
    userId: user.id,
    room: 'Via Terni',
    date,
    start,
    end,
    people,
    preset,
    durationHours: duration,
    guests,
    totalChips,
    lockboxCode: cfg.lockboxCode,
    accessValidUntil: `${date}T${end}:00`,
  })

  void logEvent('booking_created', user.id, { bookingId: id, totalChips, preset, duration })

  // Return updated user chips
  const updatedUser = { ...user, chips: newChips }

  return Response.json(
    { booking: serializeBooking(booking), user: publicUser(updatedUser) },
    { status: 201 },
  )
}
