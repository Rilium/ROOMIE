import { getUserById, adjustUserChips, recordTransaction, logEvent, publicUser } from '@/lib/neon-db'
import { requireAdmin, storageGuard } from '@/lib/api-helpers'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user: admin } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const amount = Number(body.amount || 0)
  if (!Number.isInteger(amount) || amount < -500 || amount > 500 || amount === 0) {
    return Response.json({ error: 'BAD_AMOUNT' }, { status: 400 })
  }

  const { id } = await params
  const targetUser = await getUserById(id)
  if (!targetUser) return Response.json({ error: 'USER_NOT_FOUND' }, { status: 404 })

  const newChips = await adjustUserChips(id, amount)
  await recordTransaction({
    userId: id,
    type: 'admin_adjustment',
    chipsDelta: amount,
    chipsAfter: newChips,
    note: `admin:${admin.id}`,
  })
  void logEvent('admin_wallet_adjust', admin.id, { targetUserId: id, amount })

  return Response.json({ user: publicUser({ ...targetUser, chips: newChips }) })
}
