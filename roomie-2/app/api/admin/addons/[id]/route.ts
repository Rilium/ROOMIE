import { patchAddon, logEvent } from '@/lib/neon-db'
import { requireAdmin, storageGuard, csrfGuard } from '@/lib/api-helpers'
import { serializeAddon } from '@/lib/utils'

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

  const patch: Record<string, unknown> = {}
  for (const key of ['name', 'description', 'brand', 'category', 'status'] as const) {
    if (body[key] !== undefined) patch[key] = String(body[key]).trim()
  }
  if (body.price !== undefined) {
    const price = Number(body.price)
    if (!Number.isInteger(price) || price < 0) {
      return Response.json({ error: 'BAD_PRICE' }, { status: 400 })
    }
    patch.price = price
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addon = await patchAddon(id, patch as any)
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
