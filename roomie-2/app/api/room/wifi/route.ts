import { requireAuth } from '@/lib/api-helpers'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const ssid = process.env.ROOMIE_WIFI_SSID || ''
  const password = process.env.ROOMIE_WIFI_PASSWORD || ''

  return Response.json({
    wifi: {
      ssid,
      password,
      configured: Boolean(ssid && password),
    },
  })
}
