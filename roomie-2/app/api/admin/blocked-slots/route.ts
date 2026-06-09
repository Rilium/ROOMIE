import { randomUUID } from 'crypto'
import { createBlockedSlot } from '@/lib/repositories/blocked-slots'
import { logEvent } from '@/lib/repositories/audit'
import { requireAdmin, storageGuard, csrfGuard } from '@/lib/api-helpers'
import { isValidDateString, isValidTimeString } from '@/lib/utils'

export async function POST(req: Request) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const date = String(body.date || '')
  const start = String(body.start || '')
  const end = String(body.end || '')

  if (!isValidDateString(date) || !isValidTimeString(start) || !isValidTimeString(end) || start === end) {
    return Response.json({ error: 'BAD_SLOT' }, { status: 400 })
  }

  let slot
  try {
    slot = await createBlockedSlot({
      id: randomUUID(),
      date,
      start,
      end,
      reason: String(body.reason || 'Blocco admin').trim(),
      createdBy: user.id,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'SLOT_BLOCKED') {
      return Response.json({ error: 'SLOT_BLOCKED' }, { status: 409 })
    }
    throw err
  }

  await logEvent('admin_block_slot', user.id, { slotId: slot.id, date, start, end })
  return Response.json({ slot }, { status: 201 })
}
