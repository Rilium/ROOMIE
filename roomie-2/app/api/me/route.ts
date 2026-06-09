import { publicUser } from '@/lib/repositories/users'
import { resolveRoomieUserFromRequest, STORAGE_OK } from '@/lib/api-helpers'
import { hasUsableClerkConfig } from '@/lib/clerk-config'

export async function GET(req: Request) {
  if (!hasUsableClerkConfig()) return Response.json({ user: null })
  if (!STORAGE_OK) {
    return Response.json({ user: null, error: 'STORAGE_NOT_CONFIGURED' }, { status: 503 })
  }

  try {
    const user = await resolveRoomieUserFromRequest(req)
    if (!user) {
      console.warn('[/api/me] ROOMIE profile not resolved', {
        hasAuthorization: Boolean(req.headers.get('authorization')),
        hasCookie: Boolean(req.headers.get('cookie')),
      })
      return Response.json({ user: null })
    }
    return Response.json({ user: publicUser(user) })
  } catch (err) {
    console.error('[/api/me] error:', err)
    return Response.json({ user: null, error: 'ROOMIE_PROFILE_ERROR' }, { status: 503 })
  }
}
