import { deleteBlockedSlot, logEvent } from '@/lib/neon-db'
import { requireAdmin, storageGuard } from '@/lib/api-helpers'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const { id } = await params
  await deleteBlockedSlot(id)

  void logEvent('admin_unblock_slot', user.id, { slotId: id })
  return Response.json({ ok: true })
}
