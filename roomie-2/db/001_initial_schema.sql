-- ── ROOMIE — Initial Relational Schema ────────────────────────────────────────
-- Run once against Neon PostgreSQL.
-- Target: roomie-2 (Next.js rewrite). Replaces JSON blob storage.

-- ── EXTENSIONS ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive text for email/username

-- ── USERS ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username      CITEXT      NOT NULL UNIQUE,
  email         CITEXT      NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  chips         INTEGER     NOT NULL DEFAULT 0 CHECK (chips >= 0),
  password_hash TEXT,                          -- NULL for OAuth-only accounts
  suspended     BOOLEAN     NOT NULL DEFAULT FALSE,
  provider      TEXT,                          -- 'google' | 'apple' | NULL
  provider_id   TEXT,                          -- OAuth subject
  avatar        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- ── CONFIG ────────────────────────────────────────────────────────────────────
-- Single-row table (id = 1).
CREATE TABLE IF NOT EXISTS config (
  id               INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hourly_price     INTEGER NOT NULL DEFAULT 12,
  day_price        INTEGER NOT NULL DEFAULT 60,
  guest_pass_price INTEGER NOT NULL DEFAULT 2,
  max_people       INTEGER NOT NULL DEFAULT 8,
  lockbox_code     TEXT    NOT NULL DEFAULT '0000',
  door_code        TEXT    NOT NULL DEFAULT '0000',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO config DEFAULT VALUES
ON CONFLICT (id) DO NOTHING;

-- ── BOOKINGS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                 TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id            TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  room               TEXT        NOT NULL DEFAULT 'Via Terni',
  date               DATE        NOT NULL,
  start_time         TIME        NOT NULL,
  end_time           TIME        NOT NULL,
  people             INTEGER     NOT NULL DEFAULT 1 CHECK (people BETWEEN 1 AND 20),
  preset             TEXT        NOT NULL DEFAULT 'ranked',
  duration_hours     NUMERIC(4,1) NOT NULL DEFAULT 2,
  guests             INTEGER     NOT NULL DEFAULT 0 CHECK (guests >= 0),
  total_chips        INTEGER     NOT NULL CHECK (total_chips >= 0),
  status             TEXT        NOT NULL DEFAULT 'confirmed'
                                  CHECK (status IN ('confirmed','pending','completed','cancelled')),
  live_mode          BOOLEAN     NOT NULL DEFAULT FALSE,
  lockbox_code       TEXT,
  door_code          TEXT,
  access_valid_from  TIMESTAMPTZ,
  access_valid_until TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id    ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date       ON bookings (date);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_date_start ON bookings (date, start_time);

-- ── WALLET TRANSACTIONS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type        TEXT        NOT NULL
                            CHECK (type IN ('topup','booking_debit','addon_debit','refund','admin_adjustment','cashback')),
  chips_delta INTEGER     NOT NULL,             -- positive = credit, negative = debit
  chips_after INTEGER     NOT NULL,             -- balance after this tx
  ref_id      TEXT,                             -- booking.id / addon_order.id / stripe_session_id
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_user_id    ON wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_created_at ON wallet_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_type       ON wallet_transactions (type);

-- ── ADDONS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addons (
  id          TEXT        PRIMARY KEY,          -- e.g. 'dazn', 'cinema'
  category    TEXT        NOT NULL DEFAULT 'modes'
                            CHECK (category IN ('featured','modes','snacks')),
  brand       TEXT        NOT NULL DEFAULT 'ROOMIE',
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  price       INTEGER     NOT NULL CHECK (price >= 0),
  status      TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','soldout','hidden','deleted')),
  sold_today  INTEGER     NOT NULL DEFAULT 0,
  sold_today_date DATE     NOT NULL DEFAULT CURRENT_DATE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO addons (id, category, brand, name, description, price, status, sold_today, sort_order)
VALUES
  ('dazn',       'featured', 'DAZN',    'DAZN Partita',        'Champions League, Serie A e big match dentro la sessione.', 5,  'active', 3, 10),
  ('cinema',     'featured', 'NETFLIX',  'Cinema Mode',         'Audio ottimizzato, streaming fullscreen e luci basse.',      3,  'active', 2, 20),
  ('horror',     'modes',    'ROOMIE',   'Mood Horror',         'Luci rosse, atmosfera dark e setup da film.',                4,  'active', 0, 30),
  ('gaming-pro', 'modes',    'PS5',      'Gaming Pro Setup',    'Monitor extra, headset premium e setup competitivo.',        8,  'active', 1, 40),
  ('neon-party', 'modes',    'SPOTIFY',  'Neon Party',          'Luci dinamiche e playlist pronta per la serata.',            5,  'active', 0, 50),
  ('pizza',      'snacks',   'PARTNER',  'Pizza Margherita',    'Delivery partner locale, pronta durante la sessione.',       9,  'active', 2, 60),
  ('beer',       'snacks',   'LOCAL',    'Birra Artigianale x4','Quattro birre locali fredde.',                                12, 'active', 1, 70),
  ('snack',      'snacks',   'MOVIE',    'Snack Box',           'Popcorn, patatine, nachos e mix dolce/salato.',              7,  'active', 4, 80)
ON CONFLICT (id) DO NOTHING;

-- ── ADDON ORDERS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addon_orders (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  booking_id  TEXT        NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  total_chips INTEGER     NOT NULL CHECK (total_chips >= 0),
  status      TEXT        NOT NULL DEFAULT 'paid'
                            CHECK (status IN ('paid','refunded','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addon_orders_user_id    ON addon_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_addon_orders_booking_id ON addon_orders (booking_id);

-- ── ADDON ORDER ITEMS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addon_order_items (
  id        TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id  TEXT    NOT NULL REFERENCES addon_orders (id) ON DELETE CASCADE,
  addon_id  TEXT    NOT NULL REFERENCES addons (id),
  name      TEXT    NOT NULL,
  brand     TEXT    NOT NULL DEFAULT 'ROOMIE',
  unit_price INTEGER NOT NULL,
  qty       INTEGER NOT NULL DEFAULT 1 CHECK (qty BETWEEN 1 AND 99),
  total     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON addon_order_items (order_id);

-- ── BLOCKED SLOTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_slots (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date       DATE        NOT NULL,
  start_time TIME        NOT NULL,
  end_time   TIME        NOT NULL,
  reason     TEXT        NOT NULL DEFAULT '',
  created_by TEXT        REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_slots_date ON blocked_slots (date);

-- ── ACCESS LOGS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_logs (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  booking_id  TEXT        REFERENCES bookings (id) ON DELETE SET NULL,
  user_id     TEXT        REFERENCES users (id) ON DELETE SET NULL,
  event       TEXT        NOT NULL
                            CHECK (event IN (
                              'lockbox_viewed','lockbox_copied',
                              'shutter_done','key_replaced',
                              'door_nfc','door_code','door_opened',
                              'session_started','session_ended'
                            )),
  method      TEXT,         -- 'nfc' | 'code' | NULL
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_booking_id ON access_logs (booking_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id    ON access_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs (created_at DESC);

-- ── STRIPE SESSIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_sessions (
  id             TEXT        PRIMARY KEY,  -- Stripe checkout session id
  user_id        TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_chips   INTEGER     NOT NULL,
  amount_eur     NUMERIC(10,2) NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','paid','already','cancelled','error')),
  payment_intent TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_sessions_user_id ON stripe_sessions (user_id);

-- ── AUDIT LOG ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type       TEXT        NOT NULL,
  user_id    TEXT        REFERENCES users (id) ON DELETE SET NULL,
  details    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_type       ON audit_log (type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_addons_updated_at
    BEFORE UPDATE ON addons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
