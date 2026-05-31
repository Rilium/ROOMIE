import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/ui-preview-v2.html', destination: '/', permanent: true },
    ]
  },
}

export default nextConfig
