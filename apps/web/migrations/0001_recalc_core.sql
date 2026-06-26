PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS campus (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  meta_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tier TEXT,
  kind TEXT NOT NULL DEFAULT 'campus',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS program (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL UNIQUE,
  level TEXT,
  category TEXT,
  plan_drive_file_id TEXT,
  plan_drive_link TEXT,
  plan_url TEXT,
  business_line TEXT,
  plan_pdf_url TEXT,
  brochure_pdf_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS program_offering (
  id TEXT PRIMARY KEY,
  campus_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  cycle TEXT NOT NULL,
  track TEXT DEFAULT 'Longitudinal',
  delivery TEXT NOT NULL DEFAULT 'CAMPUS',
  escolarizado INTEGER NOT NULL DEFAULT 0,
  ejecutivo INTEGER NOT NULL DEFAULT 0,
  escolarizado_schedule TEXT,
  ejecutivo_schedule TEXT,
  line_of_business TEXT,
  pricing_plans TEXT NOT NULL DEFAULT '[]',
  module_count INTEGER,
  subjects_by_module TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT,
  archived_reason TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campus_id) REFERENCES campus(id) ON DELETE CASCADE,
  FOREIGN KEY (program_id) REFERENCES program(id) ON DELETE CASCADE,
  UNIQUE (campus_id, program_id, cycle, track)
);

CREATE INDEX IF NOT EXISTS program_offering_campus_cycle_idx ON program_offering(campus_id, cycle);
CREATE INDEX IF NOT EXISTS program_offering_cycle_active_idx ON program_offering(cycle, is_active);

CREATE TABLE IF NOT EXISTS academic_fee (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  concept TEXT NOT NULL,
  cost_mxn INTEGER NOT NULL,
  section TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campus_academic_fee (
  id TEXT PRIMARY KEY,
  campus_id TEXT NOT NULL,
  academic_fee_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  override_cost_mxn INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campus_id) REFERENCES campus(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_fee_id) REFERENCES academic_fee(id) ON DELETE CASCADE,
  UNIQUE (campus_id, academic_fee_id)
);

CREATE INDEX IF NOT EXISTS campus_academic_fee_campus_idx ON campus_academic_fee(campus_id);

CREATE TABLE IF NOT EXISTS bulletin (
  id TEXT PRIMARY KEY,
  campus_id TEXT NOT NULL,
  cycle TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campus_id) REFERENCES campus(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS bulletin_campus_cycle_idx ON bulletin(campus_id, cycle);

CREATE TABLE IF NOT EXISTS admin_price_override (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  target_keys TEXT NOT NULL DEFAULT '{}',
  new_price REAL NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS admin_price_override_scope_active_idx ON admin_price_override(scope, is_active);

CREATE TABLE IF NOT EXISTS admin_sidebar_info (
  key TEXT PRIMARY KEY,
  value TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS file_asset (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  bucket TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER,
  owner_user_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS file_asset_usage (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES file_asset(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS file_asset_usage_target_idx ON file_asset_usage(target_type, target_id, slot, is_primary);

CREATE TABLE IF NOT EXISTS cloudflare_auth_user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cloudflare_auth_session (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES cloudflare_auth_user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS cloudflare_auth_session_user_idx ON cloudflare_auth_session(user_id, expires_at);
