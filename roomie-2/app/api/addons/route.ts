import { listAddons } from '@/lib/neon-db'
import { serializeAddon } from '@/lib/utils'

export async function GET() {
  const addons = await listAddons()
  return Response.json({ addons: addons.map(serializeAddon) })
}
