import { LEGACY_AUTH_DEPRECATION } from '@/lib/legacy-auth'

// Deprecated compatibility shim: see LEGACY_AUTH_DEPRECATION.
export async function GET() {
  void LEGACY_AUTH_DEPRECATION
  return Response.json({ error: 'MIGRATED_TO_CLERK' }, { status: 410 })
}
