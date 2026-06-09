import { LEGACY_AUTH_DEPRECATION } from '@/lib/legacy-auth'

export async function POST() {
  return Response.json({ error: LEGACY_AUTH_DEPRECATION }, { status: 410 })
}
