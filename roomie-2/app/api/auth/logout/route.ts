import { logEvent } from '@/lib/neon-db'
import { clearSessionCookie } from '@/lib/session'
import { requireAuth } from '@/lib/api-helpers'

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  void logEvent('logout', auth.user.id, {})
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': clearSessionCookie() } },
  )
}
