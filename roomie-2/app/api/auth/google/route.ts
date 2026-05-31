import { randomBytes } from 'crypto'
import { buildSessionCookie } from '@/lib/session'
import { redirectWithAuthError, appBaseUrl } from '@/lib/api-helpers'

export async function GET(req: Request) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return redirectWithAuthError(req, 'GOOGLE_NOT_CONFIGURED')
  }

  const state = randomBytes(18).toString('hex')
  const cookie = buildSessionCookie({ oauthState: state })
  const base = appBaseUrl(req)

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${base}/api/auth/google/callback`,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: state,
    state,
    prompt: 'select_account',
  })

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    302,
  )
}
