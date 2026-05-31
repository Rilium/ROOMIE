import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUserByUsername, getUserByEmail, logEvent, publicUser } from '@/lib/neon-db'
import { buildSessionCookie } from '@/lib/session'
import { storageGuard, IS_PRODUCTION_RUNTIME } from '@/lib/api-helpers'
import { normalizeUsername, normalizeEmail } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const guard = storageGuard()
    if (guard) return guard

    const body = await req.json().catch(() => ({}))
    const { username, password, remember } = body as Record<string, unknown>

    const login = normalizeUsername(username)
    // Try username match first, then email match
    let user = await getUserByUsername(login)
    if (!user) user = await getUserByEmail(normalizeEmail(login))

    if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash || '')) {
      return Response.json({ error: 'BAD_CREDENTIALS' }, { status: 401 })
    }
    if (IS_PRODUCTION_RUNTIME && user.role === 'admin' && String(password || '') === 'admin') {
      return Response.json({ error: 'ADMIN_DEFAULT_PASSWORD_DISABLED' }, { status: 403 })
    }
    if (user.suspended) {
      return Response.json({ error: 'USER_SUSPENDED' }, { status: 403 })
    }

    const maxAge = remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12
    const cookie = buildSessionCookie({ userId: user.id }, maxAge)

    void logEvent('login', user.id, { username: user.username })

    return Response.json(
      { user: publicUser(user) },
      { headers: { 'Set-Cookie': cookie } },
    )
  } catch (err) {
    console.error('[login] unhandled error:', err)
    return Response.json({ error: 'INTERNAL_ERROR', detail: String(err) }, { status: 500 })
  }
}
