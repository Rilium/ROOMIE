import { adjustUserChipsWithTransaction } from '@/lib/services/wallet'
import { getUserById, publicUser } from '@/lib/repositories/users'
import { logEvent } from '@/lib/repositories/audit'
import { requireAdmin, storageGuard, csrfGuard } from '@/lib/api-helpers'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user: admin } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const amount = Number(body.amount ?? body.delta ?? 0)
  if (!Number.isInteger(amount) || amount < -500 || amount > 500 || amount === 0) {
    return Response.json({ error: 'BAD_AMOUNT' }, { status: 400 })
  }

  // ── reason is mandatory for admin chip adjustments ─────────────────────────
  const reason = String(body.reason || '').trim()
  if (!reason || reason.length < 3) {
    return Response.json({ error: 'REASON_REQUIRED' }, { status: 400 })
  }

  const { id } = await params
  const targetUser = await getUserById(id)
  if (!targetUser) return Response.json({ error: 'USER_NOT_FOUND' }, { status: 404 })

  const newChips = await adjustUserChipsWithTransaction(id, amount, admin.id, reason)

  await logEvent('admin_wallet_adjust', admin.id, {
    targetUserId: id,
    targetUsername: targetUser.username,
    amount,
    reason,
    newChips,
  })

  return Response.json({ user: publicUser({ ...targetUser, chips: newChips }) })
}
