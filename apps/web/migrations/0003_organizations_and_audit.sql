-- 0003_organizations_and_audit.sql
-- D1 schema for organizations, internal RBAC and immutable audit entries.
-- Existing Cloudflare auth users are intentionally referenced by TEXT user_id
-- without a foreign key because their legacy key shape must be verified first.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organization (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_member (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, user_id),
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_organization_member_user
  ON organization_member(user_id, status);

CREATE TABLE IF NOT EXISTS organization_invitation (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL
    CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_organization_invitation_lookup
  ON organization_invitation(organization_id, email, expires_at);

CREATE TABLE IF NOT EXISTS admin_audit_event (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  actor_user_id TEXT,
  actor_type TEXT NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('user', 'service', 'system')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  request_id TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_resource
  ON admin_audit_event(resource_type, resource_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_org_created
  ON admin_audit_event(organization_id, created_at DESC);
