import Stripe from 'stripe'
import { creditStripeCheckoutSession } from '@/lib/neon-db'
import { requireAuth, appBaseUrl } from '@/lib/api-helpers'

export async function GET(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    const base = appBaseUrl(req)
    return Response.redirect(`${base}/token?stripe=not_configured`, 302)
  }

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const url = new URL(req.url)
  const sessionId = url.searchParams.get('session_id') || ''
  const validPages = ['token', 'checkout', 'room', 'shop', 'session']
  const returnPage = validPages.includes(url.searchParams.get('return') || '')
    ? url.searchParams.get('return')!
    : 'token'

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const base = appBaseUrl(req)

  try {
    const checkout = await stripe.checkout.sessions.retrieve(sessionId)
    const result = await creditStripeCheckoutSession(checkout)
    const status = result.credited
      ? 'success'
      : result.reason === 'ALREADY_CREDITED'
        ? 'already'
        : 'pending'
    return Response.redirect(`${base}/${returnPage === 'home' ? '' : returnPage}?stripe=${status}`, 302)
  } catch {
    return Response.redirect(`${base}/${returnPage === 'home' ? '' : returnPage}?stripe=error`, 302)
  }
}
