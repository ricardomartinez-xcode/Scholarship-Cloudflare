PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS campaign_sender_profile (
  id TEXT PRIMARY KEY,
  client_key_hash TEXT NOT NULL,
  sender_phone TEXT,
  sender_label TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_sender_campaign (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  country_json TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  consent_confirmed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES campaign_sender_profile(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS campaign_sender_campaign_profile_created_idx
  ON campaign_sender_campaign(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS campaign_sender_campaign_profile_status_idx
  ON campaign_sender_campaign(profile_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS campaign_sender_recipient (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  contact_name TEXT,
  contact_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempted_at TEXT,
  sent_at TEXT,
  failed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaign_sender_campaign(id) ON DELETE CASCADE,
  UNIQUE (campaign_id, contact_value)
);

CREATE INDEX IF NOT EXISTS campaign_sender_recipient_campaign_status_idx
  ON campaign_sender_recipient(campaign_id, status, created_at ASC);
CREATE INDEX IF NOT EXISTS campaign_sender_recipient_campaign_sent_idx
  ON campaign_sender_recipient(campaign_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS campaign_sender_event (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  sender_phone TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaign_sender_campaign(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES campaign_sender_profile(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS campaign_sender_event_campaign_created_idx
  ON campaign_sender_event(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS campaign_sender_event_profile_created_idx
  ON campaign_sender_event(profile_id, created_at DESC);
