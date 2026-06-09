import { LEGACY_AUTH_DEPRECATION } from '@/lib/legacy-auth'

export function GET() {
  return Response.json({ error: LEGACY_AUTH_DEPRECATION }, { status: 410 })
}
