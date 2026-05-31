import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../'),

  async redirects() {
    return [
      { source: '/ui-preview-v2.html', destination: '/', permanent: true },
    ]
  },
}

export default nextConfig
