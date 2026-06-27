-- 0005_import_jobs.sql
-- Every bulk modification is a named, idempotent job. Large row payloads
-- should live in R2; D1 keeps metadata, validation results and errors.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS import_job (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  import_type TEXT NOT NULL
    CHECK (import_type IN (
      'academic_offers', 'prices', 'benefits', 'base_scholarships',
      'catalog', 'contacts', 'users', 'generic'
    )),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'validating', 'validated', 'applying', 'completed',
      'failed', 'cancelled', 'rolled_back'
    )),
  dry_run INTEGER NOT NULL DEFAULT 1 CHECK (dry_run IN (0, 1)),
  idempotency_key TEXT NOT NULL UNIQUE,
  source_filename TEXT,
  source_r2_key TEXT,
  source_sha256 TEXT,
  options_json TEXT NOT NULL DEFAULT '{}',
  summary_json TEXT NOT NULL DEFAULT '{}',
  requested_by_user_id TEXT,
  approved_by_user_id TEXT,
  started_at TEXT,
  completed_at TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_import_job_status
  ON import_job(status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_import_job_org
  ON import_job(organization_id, import_type, created_at DESC);

CREATE TABLE IF NOT EXISTS import_issue (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  row_number INTEGER,
  column_name TEXT,
  code TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error'
    CHECK (severity IN ('warning', 'error')),
  message TEXT NOT NULL,
  raw_value TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (import_job_id) REFERENCES import_job(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_import_issue_job
  ON import_issue(import_job_id, severity, row_number);

CREATE TABLE IF NOT EXISTS import_checkpoint (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  cursor_key TEXT NOT NULL,
  cursor_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (import_job_id, cursor_key),
  FOREIGN KEY (import_job_id) REFERENCES import_job(id) ON DELETE CASCADE
);
