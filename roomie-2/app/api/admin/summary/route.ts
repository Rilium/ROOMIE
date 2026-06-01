import { adminSummary, publicUser } from '@/lib/neon-db'
import { requireAdmin, storageGuard } from '@/lib/api-helpers'
import { serializeBooking, serializeAddon } from '@/lib/utils'

export async function GET(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const data = await adminSummary()

  const bookingRevenue = data.bookings.reduce((sum, b) => sum + Number(b.totalChips || 0), 0)
  const addonOrders = data.addonOrders ?? []
  const addonRevenue = addonOrders
    .filter(order => order.status === 'paid')
    .reduce((sum, order) => sum + Number(order.totalChips || 0), 0)

  const usersById = new Map(data.users.map(u => [u.id, u]))
  const enrichedBookings = data.bookings.map(b => {
    const u = usersById.get(b.userId)
    return {
      ...serializeBooking(b),
      userName: u?.name || b.userId || 'utente',
      username: u?.username || '',
      userEmail: u?.email || '',
    }
  })

  return Response.json({
    user: publicUser(user),
    summary: {
      revenue: bookingRevenue + addonRevenue,
      bookingRevenue,
      addonRevenue,
      bookings: data.bookings.length,
      pending: data.bookings.filter(b => b.status === 'pending').length,
      users: data.users.length,
      chipsInWallets: data.users.reduce((sum, u) => sum + Number(u.chips || 0), 0),
      liveSessions: data.bookings.filter(b => b.liveMode).length,
    },
    bookings: enrichedBookings,
    recentBookings: enrichedBookings.slice(0, 10),
    users: data.users.map(publicUser),
    access: {
      shutter: 'online',
      door: 'online',
      lockboxCode: data.config.lockboxCode || '0000',
      power: 'ready',
      lastTap: new Date().toISOString(),
    },
    config: data.config,
    addons: data.addons.map(serializeAddon),
    addonOrders,
    blockedSlots: data.blockedSlots,
    auditLog: (data.auditLog?.length ? data.auditLog : data.recentAccess).slice(0, 50),
  })
}
