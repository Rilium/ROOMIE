import { adjustUserChips, recordTransaction, logEvent, publicUser } from '@/lib/neon-db'
import { requireAuth, storageGuard } from '@/lib/api-helpers'

export async function POST(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const amount = Number(body.amount || 0)
  if (!Number.isInteger(amount) || amount <= 0 || amount > 500) {
    return Response.json({ error: 'BAD_AMOUNT' }, { status: 400 })
  }

  const newChips = await adjustUserChips(user.id, amount)
  await recordTransaction({
    userId: user.id,
    type: 'topup',
    chipsDelta: amount,
    chipsAfter: newChips,
    note: 'manual_topup',
  })
  void logEvent('wallet_topup', user.id, { amount })

  return Response.json({ user: publicUser({ ...user, chips: newChips }), amount })
}
