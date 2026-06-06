import { patchAddon, logEvent } from '@/lib/neon-db'
import { requireAdmin, storageGuard, csrfGuard } from '@/lib/api-helpers'
import { serializeAddon } from '@/lib/utils'
import type { Addon } from '@/lib/types'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const patch: Partial<Addon> = {}
  for (const key of ['name', 'description', 'brand'] as const) {
    if (body[key] !== undefined) patch[key] = String(body[key]).trim()
  }
  if (body.category !== undefined) {
    const category = String(body.category).trim()
    if (!['featured', 'modes', 'snacks'].includes(category)) {
      return Response.json({ error: 'BAD_CATEGORY' }, { status: 400 })
    }
    patch.category = category as Addon['category']
  }
  if (body.status !== undefined) {
    const status = String(body.status).trim()
    if (!['active', 'soldout', 'hidden', 'deleted'].includes(status)) {
      return Response.json({ error: 'BAD_STATUS' }, { status: 400 })
    }
    patch.status = status as Addon['status']
  }
  if (body.price !== undefined) {
    const price = Number(body.price)
    if (!Number.isInteger(price) || price < 0) {
      return Response.json({ error: 'BAD_PRICE' }, { status: 400 })
    }
    patch.price = price
  }

  const addon = await patchAddon(id, patch)
  if (!addon) return Response.json({ error: 'ADDON_NOT_FOUND' }, { status: 404 })

  await logEvent('admin_addon_update', user.id, { addonId: id })
  return Response.json({ addon: serializeAddon(addon) })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const { id } = await params
  const addon = await patchAddon(id, { status: 'deleted' })
  if (!addon) return Response.json({ error: 'ADDON_NOT_FOUND' }, { status: 404 })

  await logEvent('admin_addon_delete', user.id, { addonId: id })
  return Response.json({ ok: true })
}
