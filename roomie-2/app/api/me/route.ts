import { auth, currentUser } from '@clerk/nextjs/server'
import { getUserByClerkId, getOrCreateRoomieUserFromClerk, publicUser } from '@/lib/neon-db'
import { STORAGE_OK } from '@/lib/api-helpers'

export async function GET(request: Request) {
  if (!STORAGE_OK) {
    console.log('[/api/me] STORAGE_OK=false')
    return Response.json({ user: null })
  }

  try {
    const { userId: clerkId } = await auth()
    const hasBearer = !!request.headers.get('authorization')
    console.log('[/api/me] clerkId:', clerkId, 'hasBearer:', hasBearer)

    if (!clerkId) return Response.json({ user: null })

    let user = await getUserByClerkId(clerkId)
    console.log('[/api/me] dbUser:', user?.id ?? null)

    if (!user) {
      const clerkUser = await currentUser()
      console.log('[/api/me] currentUser:', clerkUser?.id ?? null)
      if (clerkUser) user = await getOrCreateRoomieUserFromClerk(clerkUser)
      console.log('[/api/me] created/found:', user?.id ?? null)
    }

    return Response.json({ user: user ? publicUser(user) : null })
  } catch (err) {
    console.error('[/api/me] error:', err)
    return Response.json({ user: null })
  }
}
