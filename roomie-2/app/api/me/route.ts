import { getUserById, publicUser } from '@/lib/neon-db'
import { getAuthUserId, STORAGE_OK } from '@/lib/api-helpers'

export async function GET(req: Request) {
  if (!STORAGE_OK) return Response.json({ user: null })

  const userId = getAuthUserId(req)
  if (!userId) return Response.json({ user: null })

  try {
    const user = await getUserById(userId)
    if (!user) return Response.json({ user: null })
    return Response.json({ user: publicUser(user) })
  } catch {
    return Response.json({ user: null })
  }
}
