import { NextResponse } from 'next/server'
import { upsertGoogleUserFromProfile, logEvent } from '@/lib/neon-db'
import { getSessionFromRequest, buildSessionCookie } from '@/lib/session'
import {
  redirectWithAuthError,
  appBaseUrl,
  googleTokenErrorCode,
} from '@/lib/api-helpers'
import { isValidEmailString, normalizeEmail } from '@/lib/utils'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      return redirectWithAuthError(req, error === 'access_denied' ? 'GOOGLE_CANCELLED' : 'GOOGLE_TOKEN_ERROR')
    }

    const session = getSessionFromRequest(req)
    if (!code || !state || state !== session.oauthState) {
      return redirectWithAuthError(req, 'SOCIAL_STATE_ERROR')
    }

    const base = appBaseUrl(req)
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: `${base}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const token = (await tokenRes.json()) as Record<string, unknown>

    if (!tokenRes.ok || !token.access_token) {
      console.error('Google token exchange failed', {
        status: tokenRes.status,
        error: token.error,
        description: token.error_description,
        redirectUri: `${base}/api/auth/google/callback`,
        hasClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
        hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      })
      return redirectWithAuthError(req, googleTokenErrorCode(token))
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token as string}` },
    })
    const profile = (await profileRes.json()) as Record<string, unknown>
    const rawEmail = typeof profile.email === 'string' ? profile.email : ''
    const rawSub = typeof profile.sub === 'string' ? profile.sub : ''
    const email = normalizeEmail(rawEmail)

    if (!profileRes.ok || !isValidEmailString(email) || !rawSub) {
      return redirectWithAuthError(req, 'GOOGLE_PROFILE_ERROR')
    }

    const user = await upsertGoogleUserFromProfile(profile as { email?: string; sub?: string; name?: string; picture?: string })
    if (!user) return redirectWithAuthError(req, 'GOOGLE_PROFILE_ERROR')
    if (user.suspended) return redirectWithAuthError(req, 'USER_SUSPENDED')

    const maxAge = 1000 * 60 * 60 * 24 * 30
    const cookie = buildSessionCookie({ userId: user.id }, maxAge)

    await logEvent('social_login', user.id, { provider: 'google', email })

    const redirectUrl = `${base}/${user.role === 'admin' ? 'admin' : 'dashboard'}?auth=social`
    const res = NextResponse.redirect(redirectUrl, 302)
    res.headers.set('Set-Cookie', cookie)
    return res
  } catch (err) {
    console.error('Google callback failed', err)
    return redirectWithAuthError(req, 'SOCIAL_LOGIN_ERROR')
  }
}
