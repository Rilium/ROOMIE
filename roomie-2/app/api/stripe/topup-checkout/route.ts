import Stripe from 'stripe'
import { requireAuth, storageGuard, appBaseUrl, csrfGuard } from '@/lib/api-helpers'
import { createStripeSession } from '@/lib/neon-db'

export async function POST(req: Request) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const guard = storageGuard()
  if (guard) return guard

  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'STRIPE_NOT_CONFIGURED' }, { status: 503 })
  }

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const amount = Number(body.amount || 0)
  if (!Number.isInteger(amount) || amount <= 0 || amount > 500) {
    return Response.json({ error: 'BAD_AMOUNT' }, { status: 400 })
  }

  const validPages = ['token', 'checkout', 'room', 'shop', 'session']
  const returnPage = validPages.includes(String(body.returnPage || ''))
    ? String(body.returnPage)
    : 'token'

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const base = appBaseUrl(req)

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: amount * 100,
            product_data: {
              name: `${amount} ROOMIE chips`,
              description: 'Saldo prepagato per prenotazioni e addon Roomie',
            },
          },
        },
      ],
      metadata: {
        userId: user.id,
        chips: String(amount),
      },
      success_url: `${base}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}&return=${returnPage}`,
      cancel_url: `${base}/?page=${returnPage}&stripe=cancelled`,
    })
    await createStripeSession({
      id: checkout.id,
      userId: user.id,
      amountChips: amount,
      amountEur: amount,
    })
    return Response.json({ url: checkout.url })
  } catch (_err) {
    return Response.json({ error: 'STRIPE_CHECKOUT_ERROR' }, { status: 500 })
  }
}
