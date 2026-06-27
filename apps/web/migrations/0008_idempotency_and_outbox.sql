-- 0008_idempotency_and_outbox.sql
-- Prevents duplicated external effects and records events to deliver through
-- Cloudflare Queues. The Queue is the executor; D1 is the durable ledger.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS idempotency_record (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  UNIQUE (scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expiry
  ON idempotency_record(expires_at);

CREATE TABLE IF NOT EXISTS outbox_event (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  topic TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'enqueued', 'processing', 'delivered', 'failed', 'discarded')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox_event(status, available_at ASC);

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
  ON outbox_event(aggregate_type, aggregate_id, created_at ASC);
