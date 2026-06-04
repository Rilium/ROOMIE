import { auth, currentUser } from '@clerk/nextjs/server'
import { getUserByClerkId, getOrCreateRoomieUserFromClerk, publicUser } from '@/lib/neon-db'
import { STORAGE_OK } from '@/lib/api-helpers'
import { hasUsableClerkConfig } from '@/lib/clerk-config'

export async function GET() {
  if (!STORAGE_OK) return Response.json({ user: null })
  if (!hasUsableClerkConfig()) return Response.json({ user: null })

  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return Response.json({ user: null })

    let user = await getUserByClerkId(clerkId)

    if (!user) {
      const clerkUser = await currentUser()
      if (clerkUser) user = await getOrCreateRoomieUserFromClerk(clerkUser)
    }

    return Response.json({ user: user ? publicUser(user) : null })
  } catch (err) {
    console.error('[/api/me] error:', err)
    return Response.json({ user: null })
  }
}
