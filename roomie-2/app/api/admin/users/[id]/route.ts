import { getUserById, logEvent, publicUser } from '@/lib/neon-db'
import { neon } from '@neondatabase/serverless'
import { requireAdmin, storageGuard } from '@/lib/api-helpers'
import { normalizeEmail } from '@/lib/utils'

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

  const { id } = await params
  const user = await getUserById(id)
  if (!user) return Response.json({ error: 'USER_NOT_FOUND' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) updates.name = String(body.name || user.name).trim()
  if (body.email !== undefined) updates.email = normalizeEmail(body.email)
  if (body.role !== undefined) {
    const role = String(body.role)
    if (!['user', 'admin'].includes(role)) {
      return Response.json({ error: 'BAD_ROLE' }, { status: 400 })
    }
    updates.role = role
  }
  if (body.suspended !== undefined) updates.suspended = Boolean(body.suspended)

  const sql = getDb()
  await sql`
    UPDATE users SET
      name      = COALESCE(${(updates.name as string) ?? null}, name),
      email     = COALESCE(${(updates.email as string) ?? null}, email),
      role      = COALESCE(${(updates.role as string) ?? null}, role),
      suspended = COALESCE(${(updates.suspended as boolean) ?? null}, suspended)
    WHERE id = ${id}
  `

  void logEvent('admin_user_update', admin.id, { targetUserId: id })
  return Response.json({ user: publicUser({ ...user, ...updates } as typeof user) })
}
