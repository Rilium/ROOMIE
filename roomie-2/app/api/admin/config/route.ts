import { patchConfig, logEvent } from '@/lib/neon-db'
import { requireAdmin, storageGuard } from '@/lib/api-helpers'

export async function PATCH(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { user } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const patch: Record<string, unknown> = {}

  for (const key of ['hourlyPrice', 'dayPrice', 'guestPassPrice', 'maxPeople'] as const) {
    if (body[key] !== undefined) {
      const value = Number(body[key])
      if (!Number.isFinite(value) || value < 0) {
        return Response.json({ error: 'BAD_CONFIG' }, { status: 400 })
      }
      if (key === 'maxPeople' && (!Number.isInteger(value) || value < 1 || value > 30)) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = await patchConfig(patch as any)
  void logEvent('admin_config_update', user.id, patch)

  return Response.json({ config })
}
