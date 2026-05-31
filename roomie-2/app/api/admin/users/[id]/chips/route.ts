import { getUserById, logEvent, publicUser } from '@/lib/neon-db'
import { neon } from '@neondatabase/serverless'
import { requireAdmin, storageGuard } from '@/lib/api-helpers'

function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return neon(url)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user: admin } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const amount = Number(body.amount || 0)
  if (!Number.isInteger(amount) || amount < -500 || amount > 500 || amount === 0) {
    return Response.json({ error: 'BAD_AMOUNT', detail: 'Integer between -500 and 500, non-zero' }, { status: 400 })
  }

  // ── reason is mandatory for admin chip adjustments ─────────────────────────
  const reason = String(body.reason || '').trim()
  if (!reason || reason.length < 3) {
    return Response.json({ error: 'REASON_REQUIRED', detail: 'Provide reason (min 3 chars)' }, { status: 400 })
  }

  const { id } = await params
  const targetUser = await getUserById(id)
  if (!targetUser) return Response.json({ error: 'USER_NOT_FOUND' }, { status: 404 })

  // ── Atomic CTE: adjust chips + record wallet transaction ───────────────────
  const sql = getDb()
  const noteStr = `admin:${admin.id}:${reason}`
  const rows = await sql`
    WITH
      chip_update AS (
        UPDATE users SET chips = GREATEST(0, chips + ${amount})
        WHERE id = ${id}
        RETURNING chips
      ),
      _tx AS (
        INSERT INTO wallet_transactions (user_id, type, chips_delta, chips_after, ref_id, note)
        SELECT ${id}, 'admin_adjustment', ${amount}, chips, ${admin.id}, ${noteStr}
        FROM chip_update
      )
    SELECT chips AS new_chips FROM chip_update
  `
  const newChips = Number(rows[0]?.new_chips ?? 0)

  await logEvent('admin_wallet_adjust', admin.id, {
    targetUserId: id,
    targetUsername: targetUser.username,
    amount,
    reason,
    newChips,
  })

  return Response.json({ user: publicUser({ ...targetUser, chips: newChips }) })
}
