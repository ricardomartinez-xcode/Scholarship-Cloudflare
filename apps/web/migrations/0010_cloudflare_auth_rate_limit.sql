-- 0010_cloudflare_auth_rate_limit.sql
-- Distributed login attempt counters for the Cloudflare-native password flow.
-- Keys are SHA-256 digests generated in the Worker; raw email/IP values are
-- never written to D1.

CREATE TABLE IF NOT EXISTS cloudflare_auth_rate_limit (
  key_hash TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  window_expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cloudflare_auth_rate_limit_expiry
  ON cloudflare_auth_rate_limit(window_expires_at ASC);
