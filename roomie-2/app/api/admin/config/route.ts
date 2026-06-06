import { patchConfig, logEvent } from '@/lib/neon-db'
import { requireAdmin, storageGuard, csrfGuard } from '@/lib/api-helpers'
import type { AppConfig } from '@/lib/types'

export async function PATCH(req: Request) {
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const patch: Partial<AppConfig> = {}

  const ranges = {
    hourlyPrice: { min: 1, max: 250 },
    dayPrice: { min: 1, max: 2000 },
    guestPassPrice: { min: 0, max: 100 },
    maxPeople: { min: 1, max: 30 },
  } as const

  for (const key of ['hourlyPrice', 'dayPrice', 'guestPassPrice', 'maxPeople'] as const) {
    if (body[key] !== undefined) {
      const value = Number(body[key])
      const range = ranges[key]
      if (!Number.isInteger(value) || value < range.min || value > range.max) {
        return Response.json({ error: 'BAD_CONFIG' }, { status: 400 })
      }
      patch[key] = value
    }
  }

  if (body.lockboxCode !== undefined) {
    const code = String(body.lockboxCode || '').replace(/\D/g, '').slice(0, 6)
    if (code.length < 4) return Response.json({ error: 'BAD_CODE' }, { status: 400 })
    patch.lockboxCode = code
  }

  const config = await patchConfig(patch)
  const auditPatch = { ...patch }
  if ('lockboxCode' in auditPatch) auditPatch.lockboxCode = '[redacted]'
  await logEvent('admin_config_update', user.id, auditPatch)

  return Response.json({ config })
}
