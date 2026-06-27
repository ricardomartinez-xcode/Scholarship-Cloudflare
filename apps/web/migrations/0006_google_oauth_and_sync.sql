-- 0006_google_oauth_and_sync.sql
-- Do not put OAuth client secrets in D1. Per-user access/refresh tokens are
-- stored only as AES-GCM ciphertext generated in the Worker.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS oauth_connection (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google')),
  provider_subject TEXT NOT NULL,
  provider_email TEXT,
  scopes_json TEXT NOT NULL,
  refresh_token_ciphertext TEXT NOT NULL,
  access_token_ciphertext TEXT,
  access_token_expires_at TEXT,
  token_key_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'error', 'reauthorization_required')),
  last_error_code TEXT,
  last_error_message TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  UNIQUE (provider, organization_id, provider_subject),
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oauth_connection_user
  ON oauth_connection(user_id, provider, status);

CREATE TABLE IF NOT EXISTS google_sync_job (
  id TEXT PRIMARY KEY,
  oauth_connection_id TEXT NOT NULL,
  resource_type TEXT NOT NULL
    CHECK (resource_type IN ('drive', 'sheets', 'calendar')),
  direction TEXT NOT NULL DEFAULT 'pull'
    CHECK (direction IN ('pull', 'push')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  request_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT,
  completed_at TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (oauth_connection_id) REFERENCES oauth_connection(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_google_sync_job_status
  ON google_sync_job(status, created_at ASC);

CREATE TABLE IF NOT EXISTS google_sync_cursor (
  id TEXT PRIMARY KEY,
  oauth_connection_id TEXT NOT NULL,
  resource_type TEXT NOT NULL
    CHECK (resource_type IN ('drive', 'sheets', 'calendar')),
  cursor_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (oauth_connection_id, resource_type),
  FOREIGN KEY (oauth_connection_id) REFERENCES oauth_connection(id) ON DELETE CASCADE
);
