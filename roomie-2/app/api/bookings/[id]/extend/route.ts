import {
  getBookingById,
  extendBooking,
  extendBookingAtomic,
  hasBookingConflictNeon,
  logEvent,
  getConfig,
  publicUser,
  getUserById,
} from '@/lib/neon-db'
import { requireAuth, storageGuard } from '@/lib/api-helpers'
import { addHoursToTime, serializeBooking } from '@/lib/utils'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const { id } = await params
  const booking = await getBookingById(id)
  if (!booking || (booking.userId !== user.id && user.role !== 'admin')) {
    return Response.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 })
  }
  if (!['confirmed', 'pending'].includes(booking.status)) {
    return Response.json({ error: 'BOOKING_NOT_ACTIVE' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const hours = Math.max(1, Math.min(4, Number(body.hours || 1)))
  const cfg = await getConfig()
  const price = Number(cfg.hourlyPrice) * hours
  const newEnd = addHoursToTime(booking.end, hours)

  if (await hasBookingConflictNeon(booking.date, booking.end, newEnd, booking.id)) {
    return Response.json({ error: 'SLOT_BLOCKED' }, { status: 409 })
  }

  // ── Admin extends free — no atomic needed ──────────────────────────────────
  if (user.role === 'admin') {
    const updated = await extendBooking(booking.id, newEnd, 0)
    void logEvent('booking_extended_admin', user.id, { bookingId: booking.id, hours })
    return Response.json({
      booking: serializeBooking(updated ?? { ...booking, end: newEnd }),
      user: publicUser(user),
      charged: 0,
    })
  }

  // ── Atomic: debit chips + record tx + extend booking ──────────────────────
  try {
    const { booking: updated, newChips } = await extendBookingAtomic(
      user.id,
      booking.id,
      booking.date,
      booking.end,
      newEnd,
      price,
    )

    void logEvent('booking_extended', user.id, { bookingId: booking.id, hours, price })

    const freshUser = await getUserById(user.id)
    const updatedUser = freshUser ?? { ...user, chips: newChips }

    return Response.json({
      booking: serializeBooking(updated),
      user: publicUser(updatedUser),
      charged: price,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_CHIPS') {
      return Response.json(
        { error: 'INSUFFICIENT_CHIPS', required: price },
        { status: 402 },
      )
    }
    throw err
  }
}
