import { randomUUID } from 'crypto'
import {
  getBookingsByUser,
  listBookings,
  createBookingAtomic,
} from '@/lib/services/booking'
import { getConfig } from '@/lib/repositories/config'
import { publicUser, getUserById } from '@/lib/repositories/users'
import { logEvent } from '@/lib/repositories/audit'
import { requireAuth, storageGuard, csrfGuard } from '@/lib/api-helpers'
import { bookingAccessUntilIso, calcBookingPrice, isValidDateString, isValidTimeString, serializeBookingForUser } from '@/lib/utils'

export async function GET(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const bookings = user.role === 'admin'
    ? await listBookings()
    : await getBookingsByUser(user.id)

  return Response.json({ bookings: bookings.map(b => serializeBookingForUser(b)) })
}

export async function POST(req: Request) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

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
  if (!isValidDateString(date)) {
    return Response.json({ error: 'BAD_BOOKING_DATE' }, { status: 400 })
  }
  if (!isValidTimeString(start) || !isValidTimeString(end)) {
    return Response.json({ error: 'BAD_BOOKING_TIME' }, { status: 400 })
  }
  if (start === end) {
    return Response.json({ error: 'BAD_BOOKING_TIME_RANGE' }, { status: 400 })
  }

  // ── Validate people ────────────────────────────────────────────────────────
  let cfg
  try {
    cfg = await getConfig()
  } catch {
    return Response.json({ error: 'DB_UNAVAILABLE' }, { status: 503 })
  }
  const people = Math.max(1, Number(body.people || 1))
  const maxPeople = Number(cfg.maxPeople || 8)
  const friendIds = Array.isArray(body.friendIds)
    ? body.friendIds
      .map(id => String(id || '').trim())
      .filter(id => id.length > 0)
      .slice(0, maxPeople - 1)
    : []
  if (!Number.isInteger(people) || people < 1 || people > maxPeople) {
    return Response.json({ error: 'BAD_PEOPLE', max: maxPeople }, { status: 400 })
  }

  // ── Server-side price (client value is IGNORED) ────────────────────────────
  const preset = typeof body.preset === 'string' ? body.preset : 'ranked'
  const duration = Math.max(1, Number(body.duration || 2))
  const guests = Math.max(0, Number(body.guests || 0))
  const totalChips = calcBookingPrice(preset, duration, guests, cfg)

  // ── Atomic: conflict check + debit chips + record tx + insert booking ──────
  const id = randomUUID()
  try {
    const { booking, newChips } = await createBookingAtomic(
      user.id,
      {
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
        accessValidUntil: bookingAccessUntilIso(date, start, end),
      },
      totalChips,
      `booking:${preset}:${date}`,
    )

    await logEvent('booking_created', user.id, { bookingId: id, totalChips, preset, duration, friendIds })

    const freshUser = await getUserById(user.id)
    const updatedUser = freshUser ?? { ...user, chips: newChips }

    return Response.json(
      { booking: serializeBookingForUser(booking), user: publicUser(updatedUser) },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_CHIPS') {
      return Response.json(
        { error: 'INSUFFICIENT_CHIPS', required: totalChips },
        { status: 402 },
      )
    }
    if (err instanceof Error && err.message === 'SLOT_BLOCKED') {
      return Response.json({ error: 'SLOT_BLOCKED' }, { status: 409 })
    }
    console.error('[POST /api/bookings] unexpected error:', err)
    return Response.json({ error: 'BOOKING_FAILED' }, { status: 500 })
  }
}
