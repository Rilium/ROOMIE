import { randomUUID } from 'crypto'
import {
  getBookingById,
  listAddons,
  createAddonOrderAtomic,
  logEvent,
  publicUser,
  getUserById,
} from '@/lib/neon-db'
import { requireAuth, storageGuard, csrfGuard } from '@/lib/api-helpers'
import { isBookingLiveNow } from '@/lib/utils'

export async function POST(req: Request) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

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
  if (!isBookingLiveNow(booking)) {
    return Response.json({ error: 'LIVE_BOOKING_REQUIRED' }, { status: 409 })
  }

  const allAddons = await listAddons()
  const addonMap = new Map(allAddons.map(a => [a.id, a]))

  const requestedItems = Array.isArray(body.items) ? body.items : []
  type OrderItem = { id: string; name: string; brand: string; price: number; qty: number; total: number }
  const orderItems: OrderItem[] = requestedItems
    .map((item: Record<string, unknown>) => {
      const addon = addonMap.get(String(item.id || ''))
      if (!addon || addon.status !== 'active') return null
      const rawQty = Number(item.qty || 1)
      if (!Number.isInteger(rawQty) || rawQty < 1 || rawQty > 10) return null
      const qty = rawQty
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
  const orderId = randomUUID()

  // ── Atomic: debit chips + record tx + insert order + update sold_today ─────
  try {
    const { newChips } = await createAddonOrderAtomic(
      user.id,
      orderId,
      booking.id,
      orderItems,
      totalChips,
    )

    await logEvent('addon_order_paid', user.id, { orderId, totalChips })

    const freshUser = await getUserById(user.id)
    const updatedUser = freshUser ?? { ...user, chips: newChips }

    return Response.json({
      order: {
        id: orderId,
        userId: user.id,
        bookingId: booking.id,
        items: orderItems,
        totalChips,
        status: 'paid',
        createdAt: new Date().toISOString(),
      },
      user: publicUser(updatedUser),
    }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_CHIPS') {
      return Response.json(
        { error: 'INSUFFICIENT_CHIPS', required: totalChips },
        { status: 402 },
      )
    }
    throw err
  }
}
