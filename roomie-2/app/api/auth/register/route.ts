import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getUserByUsername, getUserByEmail, createUser, isRateLimited, clearRateLimit, logEvent, publicUser } from '@/lib/neon-db'
import { buildSessionCookie } from '@/lib/session'
import { storageGuard, csrfGuard } from '@/lib/api-helpers'
import { normalizeUsername, normalizeEmail } from '@/lib/utils'

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 5

function rateLimitKey(req: Request, email: string) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  return `${ip}:${email || 'empty'}`
}

export async function POST(req: Request) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  try {
    const guard = storageGuard()
    if (guard) return guard

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const username = normalizeUsername(body.username)
    const email = normalizeEmail(body.email)
    const name = String(body.name || '').trim()
    const password = String(body.password || '')
    const remember = Boolean(body.remember)
    if (await isRateLimited(rateLimitKey(req, email), MAX_ATTEMPTS, WINDOW_MS)) {
      return Response.json({ error: 'TOO_MANY_ATTEMPTS' }, { status: 429 })
    }

    if (!name || name.length < 2) {
      return Response.json({ error: 'BAD_NAME' }, { status: 400 })
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return Response.json({ error: 'BAD_USERNAME' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'BAD_EMAIL' }, { status: 400 })
    }
    if (password.length < 8) {
      return Response.json({ error: 'WEAK_PASSWORD' }, { status: 400 })
    }

    const [existingByUsername, existingByEmail] = await Promise.all([
      getUserByUsername(username),
      getUserByEmail(email),
    ])
    if (existingByUsername) return Response.json({ error: 'USERNAME_TAKEN' }, { status: 409 })
    if (existingByEmail) return Response.json({ error: 'EMAIL_TAKEN' }, { status: 409 })

    const user = await createUser({
      id: randomUUID(),
      username,
      email,
      name,
      chips: 24,
      passwordHash: bcrypt.hashSync(password, 10),
    })

    await clearRateLimit(rateLimitKey(req, email))

    const maxAge = remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12
    const cookie = buildSessionCookie({ userId: user.id }, maxAge)

    await logEvent('register', user.id, { username, email })

    return Response.json(
      { user: publicUser(user) },
      { status: 201, headers: { 'Set-Cookie': cookie } },
    )
  } catch (err) {
    console.error('[register] unhandled error:', err)
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
