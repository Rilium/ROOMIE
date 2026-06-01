import { logEvent } from '@/lib/neon-db'
import { clearSessionCookie } from '@/lib/session'
import { requireAuth, csrfGuard } from '@/lib/api-helpers'

export async function POST(req: Request) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  await logEvent('logout', auth.user.id, {})
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': clearSessionCookie() } },
  )
}
