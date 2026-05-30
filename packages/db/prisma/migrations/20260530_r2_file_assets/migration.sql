CREATE TABLE IF NOT EXISTS "recalc_admin"."file_asset" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NULL REFERENCES "recalc_admin"."user"("id") ON DELETE SET NULL,
  "bucket" TEXT NOT NULL,
  "object_key" TEXT NOT NULL UNIQUE,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "title" TEXT NULL,
  "description" TEXT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "recalc_admin"."file_share_link" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "file_id" UUID NOT NULL REFERENCES "recalc_admin"."file_asset"("id") ON DELETE CASCADE,
  "token_hash" TEXT NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "file_asset_owner_created_idx" ON "recalc_admin"."file_asset"("owner_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "file_asset_visibility_created_idx" ON "recalc_admin"."file_asset"("visibility", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "file_share_link_file_id_idx" ON "recalc_admin"."file_share_link"("file_id");
CREATE INDEX IF NOT EXISTS "file_share_link_expires_at_idx" ON "recalc_admin"."file_share_link"("expires_at");
