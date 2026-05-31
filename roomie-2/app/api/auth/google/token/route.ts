import { upsertGoogleUserFromProfile, logEvent, publicUser } from '@/lib/neon-db'
import { getSessionFromRequest, buildSessionCookie } from '@/lib/session'
import { decodeJwtPayload, storageGuard } from '@/lib/api-helpers'

export async function POST(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const idToken = String(body.id_token || '')
    const state = String(body.state || '')

    const session = getSessionFromRequest(req)
    if (!idToken || !state || state !== session.oauthState) {
      return Response.json({ error: 'SOCIAL_STATE_ERROR' }, { status: 401 })
    }

    const tokenRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    )
    const tokenInfo = (await tokenRes.json()) as Record<string, unknown>
    const jwtPayload = decodeJwtPayload(idToken)

    const issuerOk =
      tokenInfo.iss === 'https://accounts.google.com' ||
      tokenInfo.iss === 'accounts.google.com'

    if (!tokenRes.ok || tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID || !issuerOk) {
      console.error('Google id_token validation failed', {
        status: tokenRes.status,
        error: tokenInfo.error,
        audMatches: tokenInfo.aud === process.env.GOOGLE_CLIENT_ID,
        iss: tokenInfo.iss,
      })
      return Response.json({ error: 'GOOGLE_TOKEN_ERROR' }, { status: 401 })
    }

    const nonce = (tokenInfo.nonce || jwtPayload.nonce) as string | undefined
    if (nonce !== session.oauthState) {
      return Response.json({ error: 'SOCIAL_STATE_ERROR' }, { status: 401 })
    }

    const profile = {
      ...jwtPayload,
      ...tokenInfo,
      sub: (tokenInfo.sub || jwtPayload.sub) as string,
      email: (tokenInfo.email || jwtPayload.email) as string,
      name: (tokenInfo.name || jwtPayload.name) as string,
      picture: (tokenInfo.picture || jwtPayload.picture) as string,
    }

    const user = await upsertGoogleUserFromProfile(profile)
    if (!user) return Response.json({ error: 'GOOGLE_PROFILE_ERROR' }, { status: 401 })
    if (user.suspended) return Response.json({ error: 'USER_SUSPENDED' }, { status: 403 })

    const maxAge = 1000 * 60 * 60 * 24 * 30
    const cookie = buildSessionCookie({ userId: user.id }, maxAge)

    void logEvent('social_login', user.id, { provider: 'google', email: profile.email, mode: 'id_token' })

    return Response.json(
      {
        user: publicUser(user),
        redirect: `/?page=${user.role === 'admin' ? 'admin' : 'dashboard'}&auth=social`,
      },
      { headers: { 'Set-Cookie': cookie } },
    )
  } catch (_err) {
    return Response.json({ error: 'SOCIAL_LOGIN_ERROR' }, { status: 500 })
  }
}
