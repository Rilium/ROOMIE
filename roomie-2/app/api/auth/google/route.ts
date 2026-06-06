import { LEGACY_AUTH_DEPRECATION } from '@/lib/legacy-auth'

// Deprecated compatibility shim: see LEGACY_AUTH_DEPRECATION.
export async function GET() {
  void LEGACY_AUTH_DEPRECATION
  return Response.redirect(
    `${process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in'}`,
    302,
  )
}
