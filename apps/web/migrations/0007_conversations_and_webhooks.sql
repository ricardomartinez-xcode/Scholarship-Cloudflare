-- 0007_conversations_and_webhooks.sql
-- Durable chat/inbox history. Presence, typing and socket state belong in a
-- Durable Object; only durable business events are persisted here.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversation (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  channel TEXT NOT NULL
    CHECK (channel IN ('app', 'whatsapp', 'meta', 'email', 'internal')),
  external_thread_id TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  title TEXT,
  assigned_to_user_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_external_thread
  ON conversation(organization_id, channel, external_thread_id)
  WHERE external_thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_inbox
  ON conversation(organization_id, status, last_message_at DESC);

CREATE TABLE IF NOT EXISTS conversation_member (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  member_type TEXT NOT NULL
    CHECK (member_type IN ('user', 'external', 'system')),
  user_id TEXT,
  external_address TEXT,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'participant'
    CHECK (role IN ('owner', 'agent', 'participant', 'observer')),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversation(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_member_user
  ON conversation_member(user_id, conversation_id);

CREATE TABLE IF NOT EXISTS conversation_message (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_member_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),
  external_message_id TEXT,
  content_text TEXT,
  content_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'queued', 'sent', 'delivered', 'failed', 'read')),
  sent_at TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversation(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_member_id) REFERENCES conversation_member(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_external_id
  ON conversation_message(conversation_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_message_timeline
  ON conversation_message(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS message_delivery (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_delivery_id TEXT,
  state TEXT NOT NULL
    CHECK (state IN ('queued', 'sent', 'delivered', 'failed', 'read')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES conversation_message(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_delivery_message
  ON message_delivery(message_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inbound_webhook_receipt (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  error_message TEXT,
  UNIQUE (provider, event_id)
);
