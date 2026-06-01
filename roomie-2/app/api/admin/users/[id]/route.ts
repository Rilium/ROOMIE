import { getUserByEmail, getUserById, logEvent, patchUserAdmin, publicUser } from '@/lib/neon-db'
import { requireAdmin, storageGuard, csrfGuard } from '@/lib/api-helpers'
import { isValidEmailString, normalizeEmail } from '@/lib/utils'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

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

  if (body.name !== undefined) {
    const name = String(body.name || '').trim()
    if (name.length < 2) return Response.json({ error: 'BAD_NAME' }, { status: 400 })
    updates.name = name
  }
  if (body.email !== undefined) {
    const email = normalizeEmail(body.email)
    if (!isValidEmailString(email)) return Response.json({ error: 'BAD_EMAIL' }, { status: 400 })
    const existing = await getUserByEmail(email)
    if (existing && existing.id !== id) return Response.json({ error: 'EMAIL_TAKEN' }, { status: 409 })
    updates.email = email
  }
  if (body.role !== undefined) {
    const role = String(body.role)
    if (!['user', 'admin'].includes(role)) {
      return Response.json({ error: 'BAD_ROLE' }, { status: 400 })
    }
    if (id === admin.id && role !== 'admin') {
      return Response.json({ error: 'CANNOT_DEMOTE_SELF' }, { status: 400 })
    }
    updates.role = role
  }
  if (body.suspended !== undefined) {
    const suspended = Boolean(body.suspended)
    if (id === admin.id && suspended) {
      return Response.json({ error: 'CANNOT_SUSPEND_SELF' }, { status: 400 })
    }
    updates.suspended = suspended
  }

  const updated = await patchUserAdmin(id, updates)

  await logEvent('admin_user_update', admin.id, { targetUserId: id })
  return Response.json({ user: publicUser(updated || ({ ...user, ...updates } as typeof user)) })
}
