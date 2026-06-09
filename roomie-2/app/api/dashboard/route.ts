import { getBookingsByUser } from '@/lib/services/booking'
import { listAddons } from '@/lib/repositories/addons'
import { getConfig } from '@/lib/repositories/config'
import { requireAuth, storageGuard } from '@/lib/api-helpers'
import { buildDashboardSummary } from '@/lib/utils'

export async function GET(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const [bookings, addons, config] = await Promise.all([
    getBookingsByUser(user.id),
    listAddons(),
    getConfig(),
  ])

  const summary = await buildDashboardSummary(user, bookings, addons, config)
  return Response.json(summary)
}
