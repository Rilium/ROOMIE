import { getBookingById } from '@/lib/services/booking'
import { logAccess } from '@/lib/repositories/audit'
import type { AccessEvent } from '@/lib/repositories/audit'
import { csrfGuard, requireAuth, storageGuard } from '@/lib/api-helpers'
import { isBookingLiveNow } from '@/lib/utils'

const ACCESS_EVENTS = new Set<AccessEvent>([
  'lockbox_viewed',
  'lockbox_copied',
  'shutter_done',
  'key_replaced',
  'door_nfc',
  'door_code',
  'door_opened',
  'session_started',
  'session_ended',
])

export async function POST(req: Request) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const bookingId = String(body.bookingId || '').trim()
  const event = String(body.event || '').trim()
  const method = String(body.method || '').trim().slice(0, 40)

  if (!bookingId) return Response.json({ error: 'BOOKING_REQUIRED' }, { status: 400 })
  if (!ACCESS_EVENTS.has(event as AccessEvent)) return Response.json({ error: 'BAD_ACCESS_EVENT' }, { status: 400 })
  const accessEvent = event as AccessEvent

  const booking = await getBookingById(bookingId)
  if (!booking) return Response.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 })
  if (booking.userId !== user.id && user.role !== 'admin') {
    return Response.json({ error: 'BOOKING_FORBIDDEN' }, { status: 403 })
  }
  if (!isBookingLiveNow(booking)) {
    return Response.json({ error: 'LIVE_BOOKING_REQUIRED' }, { status: 409 })
  }

  await logAccess({
    bookingId,
    userId: user.id,
    event: accessEvent,
    method: method || undefined,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
  })

  return Response.json({ ok: true })
}
