// ── SESSION ───────────────────────────────────────────────────────────────────
// Identical logic to server.js: HMAC-signed cookie, no external dependencies.
// Compatible with both Node.js and Edge runtimes.

import { createHmac, timingSafeEqual } from 'crypto'
import type { SessionPayload } from './types'

export const SESSION_COOKIE = 'roomie.auth'
export const SESSION_MAX_AGE = 1000 * 60 * 60 * 12 // 12 hours

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error('SESSION_SECRET env var is required in production')
    }
    return 'roomie-local-dev-secret-change-me'
  }
  return secret
}

export function signPayload(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifyPayload(token: string | undefined): SessionPayload {
  if (!token) return {}
  const parts = String(token).split('.')
  const body = parts[0]
  const signature = parts[1]
  if (!body || !signature) return {}
  const expected = createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  try {
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return {}
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (payload.exp && Number(payload.exp) < Date.now()) return {}
    return payload
  } catch {
    return {}
  }
}

export function parseCookies(header: string | null): Record<string, string> {
  return String(header || '').split(';').reduce<Record<string, string>>((cookies, part) => {
    const index = part.indexOf('=')
    if (index < 0) return cookies
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key) {
      try { cookies[key] = decodeURIComponent(value) } catch { cookies[key] = value }
    }
    return cookies
  }, {})
}

export function sessionCookieHeader(
  token: string,
  maxAge: number = SESSION_MAX_AGE,
  clear = false
): string {
  const isProduction = process.env.NODE_ENV === 'production'
  if (clear) {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`
  }
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${isProduction ? '; Secure' : ''}`
}

/** Read userId from request cookies */
export function getUserIdFromRequest(req: Request): string | null {
  const cookies = parseCookies(req.headers.get('cookie'))
  const payload = verifyPayload(cookies[SESSION_COOKIE])
  return payload.userId || null
}

/** Read full session payload from request cookies */
export function getSessionFromRequest(req: Request): SessionPayload {
  const cookies = parseCookies(req.headers.get('cookie'))
  return verifyPayload(cookies[SESSION_COOKIE])
}

/** Build a Set-Cookie header that commits the session */
export function buildSessionCookie(payload: SessionPayload, maxAge: number = SESSION_MAX_AGE): string {
  const data: SessionPayload = {}
  if (payload.userId) data.userId = payload.userId
  if (payload.oauthState) data.oauthState = payload.oauthState
  if (!data.userId && !data.oauthState) {
    return sessionCookieHeader('', maxAge, true)
  }
  data.exp = Date.now() + maxAge
  return sessionCookieHeader(signPayload(data), maxAge)
}

/** Build a Set-Cookie header that clears the session */
export function clearSessionCookie(): string {
  return sessionCookieHeader('', 0, true)
}
