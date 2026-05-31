CREATE TABLE IF NOT EXISTS "recalc_admin"."file_asset_usage" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "file_id" UUID NOT NULL REFERENCES "recalc_admin"."file_asset"("id") ON DELETE CASCADE,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "file_asset_usage_file_id_idx"
ON "recalc_admin"."file_asset_usage"("file_id");

CREATE INDEX IF NOT EXISTS "file_asset_usage_target_slot_idx"
ON "recalc_admin"."file_asset_usage"("target_type", "target_id", "slot", "sort_order");

CREATE UNIQUE INDEX IF NOT EXISTS "file_asset_usage_unique_primary_slot_idx"
ON "recalc_admin"."file_asset_usage"("target_type", "target_id", "slot")
WHERE "is_primary" = true;
