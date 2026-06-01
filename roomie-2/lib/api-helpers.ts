// ── API HELPERS ───────────────────────────────────────────────────────────────
// Helpers per Next.js App Router — usa neon-db.ts (Postgres relazionale).

import { getSessionFromRequest, parseCookies } from './session'
import { getUserById } from './neon-db'
import type { DbUser } from './types'

export const IS_PRODUCTION_RUNTIME =
  Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production'
export const STORAGE_OK = Boolean(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL,
)

/** 503 se DATABASE_URL non è configurato. */
export function storageGuard(): Response | null {
  if (!STORAGE_OK) {
    return Response.json(
      { error: 'STORAGE_NOT_CONFIGURED', message: 'Configura DATABASE_URL prima di usare dati reali.' },
      { status: 503 },
    )
  }
  return null
}

export function getSession(req: Request) {
  return getSessionFromRequest(req)
}

export const CSRF_COOKIE = 'roomie.csrf'
const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

export function csrfGuard(req: Request): Response | null {
  if (!UNSAFE_METHODS.has(req.method.toUpperCase())) return null

  const origin = req.headers.get('origin')
  if (origin) {
    const requestUrl = new URL(req.url)
    const expected = `${requestUrl.protocol}//${requestUrl.host}`
    const forwardedHost = req.headers.get('x-forwarded-host')
    const forwardedProto = req.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '')
    const forwardedExpected = forwardedHost ? `${forwardedProto}://${forwardedHost}` : expected
    const appExpected = process.env.APP_URL?.replace(/\/$/, '')
    if (![expected, forwardedExpected, appExpected].filter(Boolean).includes(origin)) {
      return Response.json({ error: 'CSRF_ORIGIN_MISMATCH' }, { status: 403 })
    }
  }

  const cookies = parseCookies(req.headers.get('cookie'))
  const cookieToken = cookies[CSRF_COOKIE]
  const headerToken = req.headers.get('x-roomie-csrf') || ''
  const validShape = /^[A-Za-z0-9_-]{24,128}$/
  if (!validShape.test(cookieToken || '') || cookieToken !== headerToken) {
    return Response.json({ error: 'CSRF_REQUIRED' }, { status: 403 })
  }

  return null
}

export function getAuthUserId(req: Request): string | null {
  return getSessionFromRequest(req).userId ?? null
}

/** Legge utente autenticato dal DB oppure restituisce Response 401. */
export async function requireAuth(req: Request): Promise<{ user: DbUser } | Response> {
  const userId = getAuthUserId(req)
  if (!userId) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const user = await getUserById(userId)
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  if (user.suspended) return Response.json({ error: 'ACCOUNT_SUSPENDED' }, { status: 403 })
  return { user }
}

/** Come requireAuth ma verifica anche role=admin. */
export async function requireAdmin(req: Request): Promise<{ user: DbUser } | Response> {
  const result = await requireAuth(req)
  if (result instanceof Response) return result
  if (result.user.role !== 'admin') return Response.json({ error: 'ADMIN_REQUIRED' }, { status: 403 })
  return result
}

/** Estrae base URL dalla request. */
export function appBaseUrl(req: Request): string {
  const url = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host
  return (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, '')
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = String(token || '').split('.')[1]
    if (!payload) return {}
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function googleTokenErrorCode(token: Record<string, unknown> = {}): string {
  const error = String(token.error || '')
  const description = String(token.error_description || '').toLowerCase()
  if (error === 'invalid_client' || description.includes('client secret')) return 'GOOGLE_SECRET_INVALID'
  if (error === 'invalid_grant' || description.includes('bad request')) return 'GOOGLE_CODE_EXPIRED'
  if (error === 'redirect_uri_mismatch' || description.includes('redirect_uri')) return 'GOOGLE_REDIRECT_MISMATCH'
  return 'GOOGLE_TOKEN_ERROR'
}

export function redirectWithAuthError(req: Request, code = 'SOCIAL_NOT_CONFIGURED'): Response {
  const base = appBaseUrl(req)
  return Response.redirect(`${base}/?auth_error=${encodeURIComponent(code)}`, 302)
}
