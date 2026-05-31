import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getUserByUsername, getUserByEmail, createUser, logEvent, publicUser } from '@/lib/neon-db'
import { buildSessionCookie } from '@/lib/session'
import { storageGuard } from '@/lib/api-helpers'
import { normalizeUsername, normalizeEmail } from '@/lib/utils'

export async function POST(req: Request) {
  try {
    const guard = storageGuard()
    if (guard) return guard

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const username = normalizeUsername(body.username)
    const email = normalizeEmail(body.email)
    const name = String(body.name || '').trim()
    const password = String(body.password || '')
    const remember = Boolean(body.remember)

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

    const maxAge = remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12
    const cookie = buildSessionCookie({ userId: user.id }, maxAge)

    void logEvent('register', user.id, { username, email })

    return Response.json(
      { user: publicUser(user) },
      { status: 201, headers: { 'Set-Cookie': cookie } },
    )
  } catch (err) {
    console.error('[register] unhandled error:', err)
    return Response.json({ error: 'INTERNAL_ERROR', detail: String(err) }, { status: 500 })
  }
}
