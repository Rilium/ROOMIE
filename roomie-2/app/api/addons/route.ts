import { listAddons } from '@/lib/repositories/addons'
import { storageGuard } from '@/lib/api-helpers'
import { serializeAddon } from '@/lib/utils'

export async function GET() {
  const guard = storageGuard()
  if (guard) return guard

  try {
    const addons = await listAddons()
    return Response.json({ addons: addons.map(serializeAddon) })
  } catch {
    return Response.json({ error: 'ADDONS_UNAVAILABLE' }, { status: 500 })
  }
}
