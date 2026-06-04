import { requireAdmin } from '@/lib/api-helpers'

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (admin instanceof Response) return admin

  const secret = process.env.STRIPE_SECRET_KEY || ''
  const publishable = process.env.STRIPE_PUBLISHABLE_KEY || ''
  const webhook = process.env.STRIPE_WEBHOOK_SECRET || ''
  return Response.json({
    stripe: {
      secretConfigured: Boolean(secret),
      publishableConfigured: Boolean(publishable),
      webhookConfigured: Boolean(webhook),
      mode: secret.startsWith('sk_live_')
        ? 'live'
        : secret.startsWith('sk_test_')
          ? 'test'
          : 'unknown',
      checkoutReady: Boolean(secret),
      webhookReady: Boolean(secret && webhook),
      endpoint: `${process.env.APP_URL || 'https://roomie.rilio.it'}/api/stripe/webhook`,
    },
  })
}
