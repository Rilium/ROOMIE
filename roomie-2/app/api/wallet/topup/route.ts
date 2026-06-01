// User wallet top-ups must go through Stripe Checkout.
// Manual chip adjustments live in /api/admin/users/[id]/chips and require admin auth,
// a CSRF token, a reason, an atomic wallet transaction, and audit logging.

export async function POST() {
  return Response.json(
    { error: 'USE_STRIPE_CHECKOUT_OR_ADMIN_ADJUSTMENT' },
    { status: 410 },
  )
}
