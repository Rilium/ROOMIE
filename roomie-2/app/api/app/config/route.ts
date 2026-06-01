import { getConfig, listBlockedSlots, listBookings } from '@/lib/neon-db'
import { STORAGE_OK } from '@/lib/api-helpers'
import { ACTIVE_STATUSES } from '@/lib/utils'

const DEFAULT_CONFIG = { hourlyPrice: 12, dayPrice: 60, guestPassPrice: 2, maxPeople: 8, lockboxCode: '' }
const publicConfig = (config: typeof DEFAULT_CONFIG) => ({ ...config, lockboxCode: '' })

export async function GET() {
  if (!STORAGE_OK) {
    return Response.json({ config: DEFAULT_CONFIG, blockedSlots: [], bookedSlots: [] })
  }

  try {
    const [config, blockedSlots, allBookings] = await Promise.all([
      getConfig(),
      listBlockedSlots(),
      listBookings(),
    ])

    const bookedSlots = allBookings
      .filter(b => (ACTIVE_STATUSES as string[]).includes(b.status))
      .map(b => ({ id: b.id, date: b.date, start: b.start, end: b.end, status: b.status }))

    return Response.json({ config: publicConfig(config), blockedSlots, bookedSlots })
  } catch {
    return Response.json({ config: DEFAULT_CONFIG, blockedSlots: [], bookedSlots: [] })
  }
}
