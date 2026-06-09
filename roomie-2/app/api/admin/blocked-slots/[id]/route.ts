import { deleteBlockedSlot } from '@/lib/repositories/blocked-slots'
import { logEvent } from '@/lib/repositories/audit'
import { requireAdmin, storageGuard, csrfGuard } from '@/lib/api-helpers'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const { id } = await params
  await deleteBlockedSlot(id)

  await logEvent('admin_unblock_slot', user.id, { slotId: id })
  return Response.json({ ok: true })
}
