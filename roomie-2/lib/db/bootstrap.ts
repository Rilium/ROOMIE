import bcrypt from 'bcryptjs'
import { sqlClient } from '@/lib/db/client'
import type { Addon } from '@/lib/types'

const DEFAULT_ADDONS: Addon[] = [
  { id: 'dazn', category: 'featured', brand: 'DAZN', name: 'DAZN Partita', description: 'Champions League, Serie A e big match dentro la sessione.', price: 5, status: 'active', soldToday: 3 },
  { id: 'cinema', category: 'featured', brand: 'NETFLIX', name: 'Cinema Mode', description: 'Audio ottimizzato, streaming fullscreen e luci basse.', price: 3, status: 'active', soldToday: 2 },
  { id: 'horror', category: 'modes', brand: 'ROOMIE', name: 'Mood Horror', description: 'Luci rosse, atmosfera dark e setup da film.', price: 4, status: 'active', soldToday: 0 },
  { id: 'gaming-pro', category: 'modes', brand: 'PS5', name: 'Gaming Pro Setup', description: 'Monitor extra, headset premium e setup competitivo.', price: 8, status: 'active', soldToday: 1 },
  { id: 'neon-party', category: 'modes', brand: 'SPOTIFY', name: 'Neon Party', description: 'Luci dinamiche e playlist pronta per la serata.', price: 5, status: 'active', soldToday: 0 },
  { id: 'pizza', category: 'snacks', brand: 'PARTNER', name: 'Pizza Margherita', description: 'Delivery partner locale, pronta durante la sessione.', price: 9, status: 'active', soldToday: 2 },
  { id: 'beer', category: 'snacks', brand: 'LOCAL', name: 'Birra Artigianale x4', description: 'Quattro birre locali fredde.', price: 12, status: 'active', soldToday: 1 },
  { id: 'snack', category: 'snacks', brand: 'MOVIE', name: 'Snack Box', description: 'Popcorn, patatine, nachos e mix dolce/salato.', price: 7, status: 'active', soldToday: 4 },
]

let bootstrapPromise: Promise<void> | null = null

export async function resetAddonCountersIfNeeded(): Promise<void> {
  const sql = sqlClient()
  await sql`
    UPDATE addons
    SET sold_today = 0,
        sold_today_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE sold_today_date < CURRENT_DATE
  `
}

export async function ensureBootstrapData(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const sql = sqlClient()

      await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`

      await sql`ALTER TABLE addons ADD COLUMN IF NOT EXISTS sold_today_date DATE NOT NULL DEFAULT CURRENT_DATE`

      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id TEXT UNIQUE`
      await sql`CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users (clerk_id)`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_verification_status TEXT NOT NULL DEFAULT 'missing'`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_type TEXT`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_last4 TEXT`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_name TEXT`
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_verified_at TIMESTAMPTZ`

      await sql`
        CREATE TABLE IF NOT EXISTS rate_limits (
          key TEXT PRIMARY KEY,
          count INT NOT NULL DEFAULT 0,
          expires_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `

      await sql`
        CREATE TABLE IF NOT EXISTS audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          user_id TEXT,
          details JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `

      await sql`
        INSERT INTO config (id)
        VALUES (1)
        ON CONFLICT (id) DO NOTHING
      `

      for (const [index, addon] of DEFAULT_ADDONS.entries()) {
        await sql`
          INSERT INTO addons (id, category, brand, name, description, price, status, sold_today, sort_order)
          VALUES (
            ${addon.id},
            ${addon.category},
            ${addon.brand},
            ${addon.name},
            ${addon.description},
            ${addon.price},
            ${addon.status},
            ${addon.soldToday},
            ${(index + 1) * 10}
          )
          ON CONFLICT (id) DO NOTHING
        `
      }

      await resetAddonCountersIfNeeded()

      const adminPassword = process.env.ADMIN_PASSWORD || ''
      const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || ''
      if (adminPassword || adminPasswordHash) {
        const username = String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase()
        const email = String(process.env.ADMIN_EMAIL || 'admin@roomie.local').trim().toLowerCase()
        const name = String(process.env.ADMIN_NAME || 'ROOMIE Admin').trim()
        const passwordHash = adminPasswordHash || bcrypt.hashSync(adminPassword, 10)

        await sql`
          INSERT INTO users (id, username, email, name, role, chips, password_hash, suspended)
          VALUES ('usr_admin', ${username}, ${email}, ${name}, 'admin', 999, ${passwordHash}, FALSE)
          ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            role = 'admin',
            chips = GREATEST(users.chips, 999),
            password_hash = EXCLUDED.password_hash,
            suspended = FALSE,
            updated_at = NOW()
        `
      }
    })().catch(err => {
      bootstrapPromise = null
      throw err
    })
  }
  return bootstrapPromise
}
