import Stripe from 'stripe'
import { creditStripeCheckoutSession } from '@/lib/neon-db'
import { STORAGE_OK } from '@/lib/api-helpers'

// Next.js App Router: disable body parsing — Stripe needs raw bytes
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Stripe webhook not configured', { status: 400 })
  }
  if (!STORAGE_OK) {
    return new Response('Storage not configured', { status: 503 })
  }

  const signature = req.headers.get('stripe-signature') || ''
  const body = await req.arrayBuffer()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(body),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch {
    return new Response('Invalid Stripe signature', { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    try {
      await creditStripeCheckoutSession(event.data.object)
    } catch (err) {
      console.error('[stripe webhook] credit failed', err)
      return new Response('Stripe credit failed', { status: 500 })
    }
  }

  return Response.json({ received: true })
}
