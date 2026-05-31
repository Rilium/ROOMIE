import type { NextConfig } from 'next'
import path from 'path'

// ── ENV VALIDATION ────────────────────────────────────────────────────────────
// Fail fast at build/boot time if critical vars are missing.
// Only enforced in production (NODE_ENV=production) to keep local dev flexible.
if (process.env.NODE_ENV === 'production') {
  const REQUIRED = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'APP_URL',
  ] as const

  const missing = REQUIRED.filter(k => !process.env[k] || process.env[k]?.includes('...'))
  if (missing.length) {
    throw new Error(
      `[ROOMIE] Missing required env vars in production:\n  ${missing.join('\n  ')}\n` +
      `Run roomie-2/scripts/vercel-env-setup.sh to configure Vercel env vars.`
    )
  }

  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) {
    throw new Error('[ROOMIE] SESSION_SECRET must be at least 32 characters')
  }
}

const nextConfig: NextConfig = {
  // Fix: Next.js detects multiple lockfiles (parent ROOMIE dir + roomie-2).
  outputFileTracingRoot: path.join(__dirname, '../'),

  async redirects() {
    return [
      {
        source: '/ui-preview-v2.html',
        destination: '/',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
