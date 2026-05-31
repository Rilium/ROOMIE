import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Fix: Next.js detects multiple lockfiles (parent ROOMIE dir + roomie-2).
  // outputFileTracingRoot tells Next.js the correct project boundary.
  outputFileTracingRoot: path.join(__dirname, '../'),

  // Serve static assets identici all'originale
  // (public/ è già la dir di default in Next.js)

  // Disabilita ESLint durante build per porting veloce
  // eslint: { ignoreDuringBuilds: true },

  // Stripe webhook richiede raw body — gestito a livello di route
  // Non serve configurazione globale qui

  // Rewrite /ui-preview-v2.html → /
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
