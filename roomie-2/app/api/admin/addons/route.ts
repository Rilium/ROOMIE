import { randomUUID } from 'crypto'
import { createAddon, logEvent } from '@/lib/neon-db'
import { requireAdmin, storageGuard } from '@/lib/api-helpers'
import { serializeAddon } from '@/lib/utils'
import type { Addon } from '@/lib/types'

export async function POST(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const name = String(body.name || '').trim()
  const price = Number(body.price || 0)
  if (!name || !Number.isFinite(price) || price < 0) {
    return Response.json({ error: 'BAD_ADDON' }, { status: 400 })
  }

  const addon = await createAddon({
    id: randomUUID(),
    category: (body.category as Addon['category']) || 'featured',
    brand: String(body.brand || 'ROOMIE'),
    name,
    description: String(body.description || ''),
    price,
    status: (body.status as Addon['status']) || 'active',
  })

  void logEvent('admin_addon_create', user.id, { addonId: addon.id })
  return Response.json({ addon: serializeAddon(addon) }, { status: 201 })
}
