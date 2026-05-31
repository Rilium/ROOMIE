// GET /api/bookings/price?preset=ranked&duration=2&guests=0
// Returns the canonical server-side price for a booking configuration.
// Used by BookingPage to show accurate prices without trusting the client.

import { getConfig } from '@/lib/neon-db'
import { storageGuard } from '@/lib/api-helpers'
import { calcBookingPrice } from '@/lib/utils'

export async function GET(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const preset = searchParams.get('preset') || 'ranked'
  const duration = Math.max(1, Number(searchParams.get('duration') || 2))
  const guests = Math.max(0, Number(searchParams.get('guests') || 0))

  const cfg = await getConfig()
  const totalChips = calcBookingPrice(preset, duration, guests, cfg)
  return Response.json({ totalChips, config: cfg })
}
