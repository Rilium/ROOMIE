import { randomUUID } from 'crypto'
import {
  getBookingsByUser,
  listBookings,
  createBookingAtomic,
  hasBookingConflictNeon,
  logEvent,
  getConfig,
  publicUser,
  getUserById,
} from '@/lib/neon-db'
import { requireAuth, storageGuard, csrfGuard } from '@/lib/api-helpers'
import { bookingAccessUntilIso, calcBookingPrice, isValidDateString, isValidTimeString, serializeBooking } from '@/lib/utils'

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

  return Response.json({ bookings: bookings.map(serializeBooking) })
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

  // ── Atomic: debit chips + record tx + insert booking in one transaction ────
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

    await logEvent('booking_created', user.id, { bookingId: id, totalChips, preset, duration })

    const freshUser = await getUserById(user.id)
    const updatedUser = freshUser ?? { ...user, chips: newChips }

    return Response.json(
      { booking: serializeBooking(booking), user: publicUser(updatedUser) },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_CHIPS') {
      return Response.json(
        { error: 'INSUFFICIENT_CHIPS', required: totalChips },
        { status: 402 },
      )
    }
    throw err
  }
}
