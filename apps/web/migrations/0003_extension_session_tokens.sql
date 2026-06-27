CREATE TABLE IF NOT EXISTS extension_session_token (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'extension:default',
  client TEXT,
  extension_version TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES cloudflare_auth_user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS extension_session_token_user_valid_idx
ON extension_session_token(user_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS extension_session_token_expires_idx
ON extension_session_token(expires_at);
