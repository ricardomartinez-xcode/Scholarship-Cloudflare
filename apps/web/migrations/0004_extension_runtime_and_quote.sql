CREATE TABLE IF NOT EXISTS business_event (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_id TEXT,
  quote_session_id TEXT,
  quote_scenario_id TEXT,
  subject_type TEXT,
  subject_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS business_event_type_created_idx ON business_event(type, created_at);
CREATE INDEX IF NOT EXISTS business_event_user_created_idx ON business_event(user_id, created_at);
CREATE INDEX IF NOT EXISTS business_event_subject_created_idx ON business_event(subject_type, subject_id, created_at);

CREATE TABLE IF NOT EXISTS extension_campaign (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp_web',
  status TEXT NOT NULL DEFAULT 'queued',
  schedule_at TEXT,
  batch_size INTEGER NOT NULL DEFAULT 25,
  message_template TEXT,
  message_delay_ms INTEGER NOT NULL DEFAULT 4000,
  media_url TEXT,
  notes TEXT,
  meta TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES cloudflare_auth_user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS extension_campaign_owner_updated_idx ON extension_campaign(owner_user_id, updated_at);
CREATE INDEX IF NOT EXISTS extension_campaign_status_schedule_idx ON extension_campaign(status, schedule_at);

CREATE TABLE IF NOT EXISTS extension_campaign_recipient (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  external_key TEXT,
  contact_value TEXT NOT NULL,
  contact_name TEXT,
  payload TEXT,
  scheduled_for TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  attempted_at TEXT,
  sent_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES extension_campaign(id) ON DELETE CASCADE,
  UNIQUE (campaign_id, contact_value)
);

CREATE INDEX IF NOT EXISTS extension_campaign_recipient_claim_idx
ON extension_campaign_recipient(campaign_id, status, scheduled_for);

CREATE TABLE IF NOT EXISTS scholarship_rule (
  id TEXT PRIMARY KEY,
  enrollment_type TEXT NOT NULL,
  business_line TEXT NOT NULL,
  modality TEXT NOT NULL,
  plan INTEGER NOT NULL,
  campus_tier TEXT NOT NULL DEFAULT 'ANY',
  region TEXT NOT NULL DEFAULT '',
  plantel TEXT NOT NULL DEFAULT '',
  programa_key TEXT NOT NULL DEFAULT '',
  min_average REAL,
  max_average REAL,
  scholarship_percent REAL,
  discounted_price_mxn REAL,
  origin TEXT,
  source_version TEXT NOT NULL DEFAULT 'canonical',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS scholarship_rule_lookup_idx ON scholarship_rule(business_line, modality, plan);
CREATE INDEX IF NOT EXISTS scholarship_rule_source_enrollment_idx ON scholarship_rule(source_version, enrollment_type);
CREATE INDEX IF NOT EXISTS scholarship_rule_programa_key_idx ON scholarship_rule(programa_key);
CREATE INDEX IF NOT EXISTS scholarship_rule_plantel_idx ON scholarship_rule(plantel);

CREATE TABLE IF NOT EXISTS admin_additional_benefit (
  id TEXT PRIMARY KEY,
  applies_to_all INTEGER NOT NULL DEFAULT 0,
  benefit_type TEXT NOT NULL DEFAULT 'percentage',
  enrollment_type TEXT,
  extra_percent INTEGER NOT NULL DEFAULT 0,
  first_payment_amount REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  business_line TEXT,
  modality TEXT,
  duration TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS admin_additional_benefit_active_idx
ON admin_additional_benefit(is_active, benefit_type);

CREATE TABLE IF NOT EXISTS admin_additional_benefit_campus (
  benefit_id TEXT NOT NULL,
  campus_id TEXT NOT NULL,
  PRIMARY KEY (benefit_id, campus_id),
  FOREIGN KEY (benefit_id) REFERENCES admin_additional_benefit(id) ON DELETE CASCADE,
  FOREIGN KEY (campus_id) REFERENCES campus(id) ON DELETE CASCADE
);
