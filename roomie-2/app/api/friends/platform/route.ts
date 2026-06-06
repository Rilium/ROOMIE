import { requireAuth, storageGuard } from '@/lib/api-helpers'
import { hasUsableClerkSecretKey } from '@/lib/clerk-config'

export async function GET(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const q = new URL(req.url).searchParams.get('q')?.trim().toLowerCase() || ''
  if (q.length < 2) return Response.json({ friends: [] })

  if (!hasUsableClerkSecretKey()) {
    return Response.json({ error: 'CLERK_NOT_CONFIGURED', friends: [] }, { status: 503 })
  }

  try {
    const { auth, clerkClient } = await import('@clerk/nextjs/server')
    const [{ userId: currentClerkId }, client] = await Promise.all([auth(), clerkClient()])
    const result = await client.users.getUserList({
      query: q,
      limit: 8,
      orderBy: '-last_sign_in_at',
    })

    const friends = result.data
      .filter(clerkUser => clerkUser.id !== currentClerkId)
      .map(clerkUser => {
        const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? ''
        const username = clerkUser.username || email.split('@')[0] || clerkUser.id.slice(-8)
        const name = clerkUser.fullName || username
        return {
          id: clerkUser.id,
          username,
          name,
          avatar: clerkUser.imageUrl,
          initials: String(name || username || 'U')
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part[0] || '')
            .join('')
            .toUpperCase(),
          meta: email ? email.replace(/^(.{2}).*(@.*)$/, '$1***$2') : '@' + username,
          source: 'clerk_users_api',
        }
      })

    return Response.json({ source: 'clerk_users_api', friends })
  } catch (err) {
    console.error('[friends/platform] Clerk users API search failed:', err)
    return Response.json({ error: 'CLERK_USERS_API_FAILED', friends: [] }, { status: 502 })
  }
}
