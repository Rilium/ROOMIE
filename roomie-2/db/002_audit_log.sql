-- ── 002_audit_log.sql ────────────────────────────────────────────────────────
-- Generic audit log table used by logEvent() in neon-db.ts.
-- Run after 001_initial_schema.sql.

CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT        NOT NULL,
  user_id    TEXT,
  details    JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_type       ON audit_log (type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
