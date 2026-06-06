import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  async headers() {
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' https://fonts.gstatic.com https://pro.fontawesome.com data:",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://pro.fontawesome.com https://cdn.jsdelivr.net",
          `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com https://cdn.jsdelivr.net https://unpkg.com https://clerk.rilio.it https://accounts.rilio.it https://*.clerk.com https://*.clerk.dev https://*.clerk.accounts.dev https://challenges.cloudflare.com`,
          "connect-src 'self' https://api.stripe.com https://clerk.rilio.it https://accounts.rilio.it https://*.clerk.com https://*.clerk.dev https://*.clerk.services https://*.clerk.accounts.dev https://challenges.cloudflare.com",
          "frame-src https://js.stripe.com https://hooks.stripe.com https://accounts.rilio.it https://clerk.rilio.it https://*.clerk.com https://*.clerk.dev https://*.clerk.accounts.dev https://challenges.cloudflare.com",
          "form-action 'self' https://checkout.stripe.com",
          "worker-src 'self' blob:",
          "upgrade-insecure-requests",
        ].join('; '),
      },
    ]
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  async redirects() {
    return [
      { source: '/ui-preview-v2.html', destination: '/', permanent: true },
    ]
  },
}

export default nextConfig
