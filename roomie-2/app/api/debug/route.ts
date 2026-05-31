// ⚠️  TEMPORANEO — rimuovere prima del go-live
import { neon } from '@neondatabase/serverless'

// ── Migration SQL inline ──────────────────────────────────────────────────────
const SCHEMA_001 = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'
);
INSERT INTO app_config (key, value) VALUES
  ('main', '{"hourlyPrice":12,"dayPrice":60,"guestPassPrice":2,"maxPeople":8,"lockboxCode":"0000"}')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username      CITEXT      NOT NULL UNIQUE,
  email         CITEXT      NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  chips         INTEGER     NOT NULL DEFAULT 0 CHECK (chips >= 0),
  password_hash TEXT,
  suspended     BOOLEAN     NOT NULL DEFAULT FALSE,
  provider      TEXT,
  provider_id   TEXT,
  avatar        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             TEXT        NOT NULL REFERENCES users(id),
  room                TEXT        NOT NULL DEFAULT 'Via Terni',
  date                DATE        NOT NULL,
  start_time          TIME        NOT NULL,
  end_time            TIME        NOT NULL,
  people              INTEGER     NOT NULL DEFAULT 1,
  preset              TEXT        NOT NULL DEFAULT 'ranked',
  duration_hours      INTEGER     NOT NULL DEFAULT 2,
  guests              INTEGER     NOT NULL DEFAULT 0,
  total_chips         INTEGER     NOT NULL DEFAULT 0,
  status              TEXT        NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','pending','completed','cancelled')),
  live_mode           BOOLEAN     NOT NULL DEFAULT FALSE,
  lockbox_code        TEXT,
  door_code           TEXT,
  access_valid_from   TIMESTAMPTZ,
  access_valid_until  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      TEXT        NOT NULL REFERENCES users(id),
  type         TEXT        NOT NULL CHECK (type IN ('topup','booking_debit','addon_debit','refund','admin_adjustment','cashback')),
  chips_delta  INTEGER     NOT NULL,
  chips_after  INTEGER     NOT NULL,
  ref_id       TEXT,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addons (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT        NOT NULL,
  description TEXT,
  brand       TEXT,
  price       INTEGER     NOT NULL DEFAULT 0,
  category    TEXT,
  image_url   TEXT,
  status      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden','deleted')),
  sold_today  INTEGER     NOT NULL DEFAULT 0,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addon_orders (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT        NOT NULL REFERENCES users(id),
  booking_id  TEXT        NOT NULL REFERENCES bookings(id),
  total_chips INTEGER     NOT NULL DEFAULT 0,
  status      TEXT        NOT NULL DEFAULT 'paid',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addon_order_items (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id   TEXT        NOT NULL REFERENCES addon_orders(id),
  addon_id   TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  brand      TEXT,
  unit_price INTEGER     NOT NULL DEFAULT 0,
  qty        INTEGER     NOT NULL DEFAULT 1,
  total      INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blocked_slots (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date       DATE        NOT NULL,
  start_time TIME        NOT NULL,
  end_time   TIME        NOT NULL,
  reason     TEXT        NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_logs (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT        REFERENCES users(id),
  booking_id TEXT        REFERENCES bookings(id),
  event      TEXT        NOT NULL,
  method     TEXT,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stripe_sessions (
  id             TEXT        PRIMARY KEY,
  user_id        TEXT        NOT NULL REFERENCES users(id),
  amount_chips   INTEGER     NOT NULL,
  amount_eur     NUMERIC(10,2),
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','already','expired')),
  payment_intent TEXT,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT        NOT NULL,
  user_id    TEXT,
  details    JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export async function GET() {
  const runMigration = true

  const results: Record<string, unknown> = {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.slice(0, 30) + '...)' : 'MISSING',
    SESSION_SECRET: process.env.SESSION_SECRET ? `SET (${process.env.SESSION_SECRET.length} chars)` : 'MISSING',
    NODE_ENV: process.env.NODE_ENV,
  }

  if (!process.env.DATABASE_URL) {
    return Response.json(results)
  }

  const sql = neon(process.env.DATABASE_URL)

  if (runMigration) {
    try {
      // Split on semicolons but preserve DO $$ blocks
      const statements = SCHEMA_001
        .split(/;\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      let executed = 0
      for (const stmt of statements) {
        try {
          await sql.unsafe(stmt)
          executed++
        } catch (e) {
          // Log but continue — IF NOT EXISTS means most errors are harmless
          console.warn('Migration stmt warning:', String(e).slice(0, 100))
        }
      }
      results.migration = `ran ${executed} statements`
    } catch (e) {
      results.migration_error = String(e)
    }
  }

  try {
    const rows = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    results.db_tables = rows.map((r: Record<string, unknown>) => r.table_name)
    results.db_status = 'OK'
  } catch (e) {
    results.db_status = 'ERROR'
    results.db_error = String(e)
  }

  return Response.json(results)
}
