-- ── ROOMIE — Clerk Auth Integration ────────────────────────────────────────────
-- Adds clerk_id to users for Clerk ↔ ROOMIE user linking.
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS).

ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users (clerk_id);
