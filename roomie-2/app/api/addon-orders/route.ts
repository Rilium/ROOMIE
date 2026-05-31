import { randomUUID } from 'crypto'
import {
  getBookingById,
  listAddons,
  createAddonOrder,
  adjustUserChips,
  recordTransaction,
  logEvent,
  publicUser,
} from '@/lib/neon-db'
import { requireAuth, storageGuard } from '@/lib/api-helpers'
import { ACTIVE_STATUSES } from '@/lib/utils'

export async function POST(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const booking = await getBookingById(String(body.bookingId || ''))
  if (!booking || (booking.userId !== user.id && user.role !== 'admin')) {
    return Response.json({ error: 'ACTIVE_BOOKING_REQUIRED' }, { status: 400 })
  }
  if (!(ACTIVE_STATUSES as string[]).includes(booking.status)) {
    return Response.json({ error: 'ACTIVE_BOOKING_REQUIRED' }, { status: 400 })
  }

  const allAddons = await listAddons()
  const addonMap = new Map(allAddons.map(a => [a.id, a]))

  const requestedItems = Array.isArray(body.items) ? body.items : []
  type OrderItem = { id: string; name: string; brand: string; price: number; qty: number; total: number }
  const orderItems: OrderItem[] = requestedItems
    .map((item: Record<string, unknown>) => {
      const addon = addonMap.get(String(item.id || ''))
      if (!addon || addon.status !== 'active') return null
      const qty = Math.max(1, Math.min(10, Number(item.qty || 1)))
      return {
        id: addon.id,
        name: addon.name,
        brand: addon.brand || 'ROOMIE',
        price: Number(addon.price || 0),
        qty,
        total: Number(addon.price || 0) * qty,
      }
    })
    .filter((item): item is OrderItem => item !== null)

  if (!orderItems.length) {
    return Response.json({ error: 'EMPTY_ORDER' }, { status: 400 })
  }

  const totalChips = orderItems.reduce((sum, item) => sum + item.total, 0)
  if (user.chips < totalChips) {
    return Response.json(
      { error: 'INSUFFICIENT_CHIPS', chips: user.chips, required: totalChips },
      { status: 402 },
    )
  }

  const newChips = await adjustUserChips(user.id, -totalChips)
  await recordTransaction({
    userId: user.id,
    type: 'addon_debit',
    chipsDelta: -totalChips,
    chipsAfter: newChips,
    note: `addon_order:${booking.id}`,
  })

  const orderId = randomUUID()
  await createAddonOrder({
    id: orderId,
    userId: user.id,
    bookingId: booking.id,
    totalChips,
    items: orderItems,
  })

  void logEvent('addon_order_paid', user.id, { orderId, totalChips })

  const updatedUser = { ...user, chips: newChips }
  return Response.json({
    order: { id: orderId, userId: user.id, bookingId: booking.id, items: orderItems, totalChips, status: 'paid', createdAt: new Date().toISOString() },
    user: publicUser(updatedUser),
  }, { status: 201 })
}
