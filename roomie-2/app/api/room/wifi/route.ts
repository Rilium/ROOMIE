import { requireAuth } from '@/lib/api-helpers'
import { getBookingsByUser } from '@/lib/services/booking'
import { bookingStartDate, isBookingLiveNow } from '@/lib/utils'

const WIFI_EARLY_ACCESS_MS = 2 * 60 * 60 * 1000

function hasWifiAccess(bookings: Awaited<ReturnType<typeof getBookingsByUser>>, now = new Date()) {
  return bookings.some(booking => {
    if (booking.status !== 'confirmed') return false
    if (isBookingLiveNow(booking, now)) return true
    const start = bookingStartDate(booking).getTime()
    return start > now.getTime() && start - now.getTime() <= WIFI_EARLY_ACCESS_MS
  })
}

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const bookings = await getBookingsByUser(user.id)
  if (!hasWifiAccess(bookings)) {
    return Response.json({ error: 'WIFI_LOCKED' }, { status: 403 })
  }

  const ssid = process.env.ROOMIE_WIFI_SSID || ''
  const password = process.env.ROOMIE_WIFI_PASSWORD || ''

  return Response.json({
    wifi: {
      ssid,
      password,
      configured: Boolean(ssid && password),
    },
  })
}
