import {
  getBookingById,
  extendBooking,
  adjustUserChips,
  recordTransaction,
  logEvent,
  getConfig,
  publicUser,
  getUserById,
} from '@/lib/neon-db'
import { requireAuth, storageGuard } from '@/lib/api-helpers'
import { addHoursToTime, serializeBooking } from '@/lib/utils'
import { hasBookingConflictNeon } from '@/lib/neon-db'

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

  if (user.role !== 'admin' && user.chips < price) {
    return Response.json(
      { error: 'INSUFFICIENT_CHIPS', chips: user.chips, required: price },
      { status: 402 },
    )
  }

  let charged = 0
  let updatedUser = user
  if (user.role !== 'admin') {
    const newChips = await adjustUserChips(user.id, -price)
    await recordTransaction({
      userId: user.id,
      type: 'booking_debit',
      chipsDelta: -price,
      chipsAfter: newChips,
      refId: booking.id,
      note: `extend:${hours}h`,
    })
    charged = price
    updatedUser = { ...user, chips: newChips }
  }

  const updated = await extendBooking(booking.id, newEnd, price)
  void logEvent('booking_extended', user.id, { bookingId: booking.id, hours, price })

  return Response.json({
    booking: serializeBooking(updated ?? { ...booking, end: newEnd }),
    user: publicUser(updatedUser),
    charged,
  })
}
