import { sqlClient } from '@/lib/db/client'
import { ensureBootstrapData } from '@/lib/db/bootstrap'
import type { AppConfig } from '@/lib/types'

export async function getConfig(): Promise<AppConfig> {
  await ensureBootstrapData()
  const sql = sqlClient()
  const rows = await sql`SELECT * FROM config WHERE id = 1`
  const row = rows[0]
  if (!row) return { hourlyPrice: 12, dayPrice: 60, guestPassPrice: 2, maxPeople: 8, lockboxCode: '' }
  return {
    hourlyPrice: Number(row.hourly_price),
    dayPrice: Number(row.day_price),
    guestPassPrice: Number(row.guest_pass_price),
    maxPeople: Number(row.max_people),
    lockboxCode: String(row.lockbox_code),
  }
}

export async function patchConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  await ensureBootstrapData()
  const sql = sqlClient()
  await sql`
    UPDATE config SET
      hourly_price     = COALESCE(${patch.hourlyPrice ?? null}, hourly_price),
      day_price        = COALESCE(${patch.dayPrice ?? null}, day_price),
      guest_pass_price = COALESCE(${patch.guestPassPrice ?? null}, guest_pass_price),
      max_people       = COALESCE(${patch.maxPeople ?? null}, max_people),
      lockbox_code     = COALESCE(${patch.lockboxCode ?? null}, lockbox_code),
      updated_at       = NOW()
    WHERE id = 1
  `
  return getConfig()
}
