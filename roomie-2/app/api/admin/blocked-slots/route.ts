import { randomUUID } from 'crypto'
import { createBlockedSlot, logEvent } from '@/lib/neon-db'
import { requireAdmin, storageGuard } from '@/lib/api-helpers'

export async function POST(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const date = String(body.date || '')
  const start = String(body.start || '')
  const end = String(body.end || '')

  if (!date || !start || !end || start >= end) {
    return Response.json({ error: 'BAD_SLOT' }, { status: 400 })
  }

  const slot = await createBlockedSlot({
    id: randomUUID(),
    date,
    start,
    end,
    reason: String(body.reason || 'Blocco admin').trim(),
    createdBy: user.id,
  })

  void logEvent('admin_block_slot', user.id, { slotId: slot.id, date, start, end })
  return Response.json({ slot }, { status: 201 })
}
