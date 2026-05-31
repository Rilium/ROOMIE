import { getBookingById, hasBookingConflictNeon, logEvent } from '@/lib/neon-db'
import { neon } from '@neondatabase/serverless'
import { requireAdmin, storageGuard } from '@/lib/api-helpers'
import { serializeBooking, ACTIVE_STATUSES } from '@/lib/utils'
import type { Booking } from '@/lib/types'

function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return neon(url)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user: admin } = auth

  const { id } = await params
  const booking = await getBookingById(id)
  if (!booking) return Response.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const next = { ...booking }
  const changedFields: string[] = []

  for (const key of ['date', 'start', 'end', 'room'] as const) {
    if (body[key] !== undefined && body[key] !== booking[key]) {
      next[key] = String(body[key])
      changedFields.push(key)
    }
  }
  if (body.people !== undefined) {
    const p = Number(body.people || 1)
    if (p !== booking.people) { next.people = p; changedFields.push('people') }
  }

  // ── totalChips override requires explicit reason ───────────────────────────
  if (body.totalChips !== undefined) {
    const reason = String(body.totalChipsReason || '').trim()
    if (!reason || reason.length < 3) {
      return Response.json(
        { error: 'REASON_REQUIRED', detail: 'Provide totalChipsReason to override booking price' },
        { status: 400 },
      )
    }
    const newTotal = Number(body.totalChips || booking.totalChips || 0)
    if (newTotal !== booking.totalChips) {
      next.totalChips = newTotal
      changedFields.push('totalChips')
    }
  }

  if (body.status !== undefined) {
    const status = String(body.status || '').trim() as Booking['status']
    if (!['confirmed', 'pending', 'completed', 'cancelled'].includes(status)) {
      return Response.json({ error: 'BAD_STATUS' }, { status: 400 })
    }
    if (status !== booking.status) {
      next.status = status
      changedFields.push('status')
    }
  }

  if (!changedFields.length) {
    return Response.json({ booking: serializeBooking(booking) })
  }

  if (
    (ACTIVE_STATUSES as string[]).includes(next.status) &&
    await hasBookingConflictNeon(next.date, next.start, next.end, booking.id)
  ) {
    return Response.json({ error: 'SLOT_BLOCKED' }, { status: 409 })
  }

  const sql = getDb()
  await sql`
    UPDATE bookings SET
      date         = ${next.date}::date,
      start_time   = ${next.start}::time,
      end_time     = ${next.end}::time,
      room         = ${next.room},
      people       = ${next.people},
      total_chips  = ${next.totalChips},
      status       = ${next.status},
      access_valid_until = (${next.date}::date + ${next.end}::time)::timestamptz
    WHERE id = ${id}
  `

  await logEvent('admin_booking_update', admin.id, {
    bookingId: id,
    changedFields,
    before: changedFields.reduce((acc, k) => ({ ...acc, [k]: (booking as unknown as Record<string, unknown>)[k] }), {}),
    after: changedFields.reduce((acc, k) => ({ ...acc, [k]: (next as unknown as Record<string, unknown>)[k] }), {}),
    reason: body.totalChipsReason || undefined,
  })

  return Response.json({ booking: serializeBooking(next) })
}
