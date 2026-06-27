-- 0009_google_oauth_state.sql
-- One-time authorization state for Google OAuth code flow.
-- `state_hash` is stored instead of the browser-visible state value. PKCE
-- verifiers are encrypted with GOOGLE_TOKEN_ENCRYPTION_KEY before persistence.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS google_oauth_state (
  state_hash TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  return_to TEXT NOT NULL,
  code_verifier_ciphertext TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_state_expiry
  ON google_oauth_state(expires_at ASC);

CREATE INDEX IF NOT EXISTS idx_google_oauth_state_user
  ON google_oauth_state(user_id, created_at DESC);
