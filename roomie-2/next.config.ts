import type { NextConfig } from 'next'
import path from 'path'

// ── ENV VALIDATION ────────────────────────────────────────────────────────────
// Hard-required: app won't boot without these.
// Soft-required: features degrade gracefully if missing (Stripe, Google, APP_URL).
if (process.env.NODE_ENV === 'production') {
  const HARD_REQUIRED = ['DATABASE_URL', 'SESSION_SECRET'] as const
  const missing = HARD_REQUIRED.filter(k => !process.env[k] || process.env[k]?.includes('...'))
  if (missing.length) {
    throw new Error(
      `[ROOMIE] Missing critical env vars:\n  ${missing.join('\n  ')}\n` +
      `Run roomie-2/scripts/vercel-env-setup.sh to configure.`
    )
  }
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) {
    throw new Error('[ROOMIE] SESSION_SECRET must be at least 32 characters')
  }

  // Soft warnings — logged but don't block build
  const SOFT_REQUIRED = [
    'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'APP_URL',
  ] as const
  const softMissing = SOFT_REQUIRED.filter(k => !process.env[k] || process.env[k]?.includes('...'))
  if (softMissing.length) {
    console.warn(`[ROOMIE] Warning: optional env vars not set: ${softMissing.join(', ')}`)
  }
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../'),

  async redirects() {
    return [
      { source: '/ui-preview-v2.html', destination: '/', permanent: true },
    ]
  },
}

export default nextConfig
