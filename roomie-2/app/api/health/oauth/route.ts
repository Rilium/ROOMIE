import { requireAdmin } from '@/lib/api-helpers'

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (admin instanceof Response) return admin

  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
  const secret = process.env.CLERK_SECRET_KEY || ''
  return Response.json({
    auth: {
      provider: 'clerk',
      publishableConfigured: Boolean(publishable),
      secretConfigured: Boolean(secret),
      signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in',
      signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up',
      ssoCallbackUrl: '/sso-callback',
    },
  })
}
