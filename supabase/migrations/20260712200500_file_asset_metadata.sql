-- Server-side metadata used by the active Supabase Storage adapter and file routes.
-- These tables are intentionally not exposed through PostgREST; file access is
-- authorized in route handlers and object access is enforced by Storage RLS.
BEGIN;

CREATE TABLE recalc_admin.file_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES recalc_admin."user"(id) ON DELETE SET NULL,
  bucket text NOT NULL,
  object_key text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  title text,
  description text,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT file_asset_size_nonnegative CHECK (size_bytes >= 0),
  CONSTRAINT file_asset_visibility_valid CHECK (
    visibility IN ('private', 'organization', 'public')
  )
);

CREATE TABLE recalc_admin.file_share_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES recalc_admin.file_asset(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recalc_admin.file_asset_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES recalc_admin.file_asset(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id text NOT NULL,
  slot text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX file_asset_owner_created_idx
  ON recalc_admin.file_asset(owner_user_id, created_at DESC);
CREATE INDEX file_asset_visibility_created_idx
  ON recalc_admin.file_asset(visibility, created_at DESC);
CREATE INDEX file_asset_mime_type_idx
  ON recalc_admin.file_asset(mime_type);
CREATE INDEX file_share_link_file_id_idx
  ON recalc_admin.file_share_link(file_id);
CREATE INDEX file_share_link_expires_at_idx
  ON recalc_admin.file_share_link(expires_at);
CREATE INDEX file_asset_usage_file_id_idx
  ON recalc_admin.file_asset_usage(file_id);
CREATE INDEX file_asset_usage_target_slot_idx
  ON recalc_admin.file_asset_usage(target_type, target_id, slot, sort_order);
CREATE UNIQUE INDEX file_asset_usage_unique_primary_slot_idx
  ON recalc_admin.file_asset_usage(target_type, target_id, slot)
  WHERE is_primary = true;

CREATE TRIGGER file_asset_set_updated_at
BEFORE UPDATE ON recalc_admin.file_asset
FOR EACH ROW EXECUTE FUNCTION recalc_admin.set_updated_at();

CREATE TRIGGER file_asset_usage_set_updated_at
BEFORE UPDATE ON recalc_admin.file_asset_usage
FOR EACH ROW EXECUTE FUNCTION recalc_admin.set_updated_at();

ALTER TABLE recalc_admin.file_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE recalc_admin.file_share_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE recalc_admin.file_asset_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  recalc_admin.file_asset,
  recalc_admin.file_share_link,
  recalc_admin.file_asset_usage
FROM anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE
  recalc_admin.file_asset,
  recalc_admin.file_share_link,
  recalc_admin.file_asset_usage
TO service_role;

COMMIT;
