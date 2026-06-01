import type { NextConfig } from 'next'

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
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://pro.fontawesome.com",
          "script-src 'self' 'unsafe-inline' https://js.stripe.com",
          "connect-src 'self' https://api.stripe.com",
          "frame-src https://js.stripe.com https://hooks.stripe.com",
          "form-action 'self' https://checkout.stripe.com",
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
