import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUserByUsername, getUserByEmail, isRateLimited, clearRateLimit, logEvent, publicUser } from '@/lib/neon-db'
import { buildSessionCookie } from '@/lib/session'
import { storageGuard, IS_PRODUCTION_RUNTIME, csrfGuard } from '@/lib/api-helpers'
import { normalizeUsername, normalizeEmail } from '@/lib/utils'

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 8

function rateLimitKey(req: NextRequest, login: string) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  return `${ip}:${login || 'empty'}`
}

export async function POST(req: NextRequest) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  try {
    const guard = storageGuard()
    if (guard) return guard

    const body = await req.json().catch(() => ({}))
    const { username, password, remember } = body as Record<string, unknown>

    const login = normalizeUsername(username)
    const limitKey = rateLimitKey(req, login)
    if (await isRateLimited(limitKey, MAX_ATTEMPTS, WINDOW_MS)) {
      return Response.json({ error: 'TOO_MANY_ATTEMPTS' }, { status: 429 })
    }

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
    await clearRateLimit(limitKey)

    const maxAge = remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12
    const cookie = buildSessionCookie({ userId: user.id }, maxAge)

    await logEvent('login', user.id, { username: user.username })

    return Response.json(
      { user: publicUser(user) },
      { headers: { 'Set-Cookie': cookie } },
    )
  } catch (err) {
    console.error('[login] unhandled error:', err)
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
