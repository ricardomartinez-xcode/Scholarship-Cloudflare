-- 0004_quote_history.sql
-- Durable quote history. Store calculated snapshots as JSON to preserve
-- reproducibility when pricing rules later change.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS quote_session (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  public_token_hash TEXT UNIQUE,
  created_by_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'archived')),
  enrollment_type TEXT NOT NULL,
  business_line TEXT NOT NULL,
  modality TEXT NOT NULL,
  plan INTEGER NOT NULL CHECK (plan > 0),
  campus_key TEXT,
  average REAL,
  subject_count INTEGER CHECK (subject_count IS NULL OR subject_count > 0),
  input_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_session_lookup
  ON quote_session(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_session_input
  ON quote_session(business_line, modality, plan, campus_key);

CREATE TABLE IF NOT EXISTS quote_scenario (
  id TEXT PRIMARY KEY,
  quote_session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  label TEXT,
  is_selected INTEGER NOT NULL DEFAULT 0 CHECK (is_selected IN (0, 1)),
  input_json TEXT NOT NULL,
  pricing_snapshot_json TEXT NOT NULL,
  scholarship_snapshot_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL,
  total_amount REAL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (quote_session_id, sequence),
  FOREIGN KEY (quote_session_id) REFERENCES quote_session(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quote_scenario_session
  ON quote_scenario(quote_session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quote_event (
  id TEXT PRIMARY KEY,
  quote_session_id TEXT NOT NULL,
  scenario_id TEXT,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'created', 'input_updated', 'scenario_created', 'scenario_selected',
      'exported', 'shared', 'converted', 'archived'
    )),
  actor_user_id TEXT,
  event_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_session_id) REFERENCES quote_session(id) ON DELETE CASCADE,
  FOREIGN KEY (scenario_id) REFERENCES quote_scenario(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_event_session
  ON quote_event(quote_session_id, created_at ASC);
