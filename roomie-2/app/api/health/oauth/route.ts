import { requireAdmin } from '@/lib/api-helpers'
import { hasUsableClerkPublishableKey, hasUsableClerkSecretKey } from '@/lib/clerk-config'

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (admin instanceof Response) return admin

  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
  const secret = process.env.CLERK_SECRET_KEY || ''
  return Response.json({
    auth: {
      provider: 'clerk',
      publishableConfigured: hasUsableClerkPublishableKey(),
      secretConfigured: hasUsableClerkSecretKey(),
      publishableKeyShape: publishable ? `${publishable.slice(0, 8)}... len=${publishable.length}` : '',
      secretKeyShape: secret ? `${secret.slice(0, 8)}... len=${secret.length}` : '',
      signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in',
      signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up',
      ssoCallbackUrl: '/sso-callback',
    },
  })
}
