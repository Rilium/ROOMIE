import { getUserByUsername, patchOwnUserProfile, publicUser } from '@/lib/repositories/users'
import { csrfGuard, requireAuth, storageGuard } from '@/lib/api-helpers'
import { normalizeUsername } from '@/lib/utils'

export async function PATCH(req: Request) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const updates: { name?: string; username?: string } = {}

  if (body.name !== undefined) {
    const name = String(body.name || '').trim()
    if (name.length < 2) return Response.json({ error: 'BAD_NAME' }, { status: 400 })
    updates.name = name
  }

  if (body.username !== undefined) {
    const username = normalizeUsername(body.username).replace(/[^a-z0-9_]/g, '_')
    if (username.length < 3 || username.length > 24) {
      return Response.json({ error: 'BAD_USERNAME' }, { status: 400 })
    }
    const existing = await getUserByUsername(username)
    if (existing && existing.id !== user.id) {
      return Response.json({ error: 'USERNAME_TAKEN' }, { status: 409 })
    }
    updates.username = username
  }

  if (!Object.keys(updates).length) {
    return Response.json({ user: publicUser(user) })
  }

  const updated = await patchOwnUserProfile(user.id, updates)
  return Response.json({ user: publicUser(updated || ({ ...user, ...updates } as typeof user)) })
}
