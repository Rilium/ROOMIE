import { LEGACY_AUTH_DEPRECATION } from '@/lib/legacy-auth'

export async function GET() {
  return Response.json({ error: LEGACY_AUTH_DEPRECATION }, { status: 410 })
}
