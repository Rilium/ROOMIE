import { auth } from '@clerk/nextjs/server'
import { logEvent } from '@/lib/repositories/audit'
import { clearSessionCookie } from '@/lib/session'
import { getUserByClerkId } from '@/lib/repositories/users'
import { hasUsableClerkConfig } from '@/lib/clerk-config'

export async function POST() {
  try {
    if (hasUsableClerkConfig()) {
      const { userId: clerkId } = await auth()
      if (clerkId) {
        const user = await getUserByClerkId(clerkId)
        if (user) await logEvent('logout', user.id, { via: 'clerk' })
      }
    }
  } catch {}

  // Clear legacy HMAC cookie in case it's still present
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': clearSessionCookie() } },
  )
}
