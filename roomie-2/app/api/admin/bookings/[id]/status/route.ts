import { getBookingById, updateBookingStatus } from '@/lib/services/booking'
import { logEvent } from '@/lib/repositories/audit'
import { requireAdmin, storageGuard, csrfGuard } from '@/lib/api-helpers'
import type { Booking } from '@/lib/types'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const { id } = await params
  const booking = await getBookingById(id)
  if (!booking) return Response.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const status = String(body.status || '').trim() as Booking['status']
  if (!['confirmed', 'pending', 'completed', 'cancelled'].includes(status)) {
    return Response.json({ error: 'BAD_STATUS' }, { status: 400 })
  }

  try {
    await updateBookingStatus(id, status)
  } catch (err) {
    if (err instanceof Error && err.message === 'SLOT_BLOCKED') {
      return Response.json({ error: 'SLOT_BLOCKED' }, { status: 409 })
    }
    throw err
  }
  await logEvent('admin_booking_status', user.id, { bookingId: id, status })

  return Response.json({ booking: { ...booking, status } })
}
