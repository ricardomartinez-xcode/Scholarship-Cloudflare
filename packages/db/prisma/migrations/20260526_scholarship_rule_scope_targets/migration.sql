-- Add configurable scope targets to base scholarship rules.
ALTER TABLE "recalc_admin"."scholarship_rule"
  ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "plantel" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "programaKey" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "recalc_admin"."scholarship_rule_programa_key_idx";
DROP INDEX IF EXISTS "recalc_admin"."scholarship_rule_plantel_idx";

ALTER TABLE "recalc_admin"."scholarship_rule"
  DROP CONSTRAINT IF EXISTS "scholarship_rule_runtime_key";

ALTER TABLE "recalc_admin"."scholarship_rule"
  DROP CONSTRAINT IF EXISTS "scholarship_rule_runtime_scope_key";

ALTER TABLE "recalc_admin"."scholarship_rule"
  ADD CONSTRAINT "scholarship_rule_runtime_scope_key"
  UNIQUE (
    "enrollmentType",
    "businessLine",
    "modality",
    "plan",
    "campusTier",
    "region",
    "plantel",
    "programaKey",
    "minAverage",
    "maxAverage",
    "sourceVersion"
  );

CREATE INDEX IF NOT EXISTS "scholarship_rule_programa_key_idx"
  ON "recalc_admin"."scholarship_rule" ("programaKey");

CREATE INDEX IF NOT EXISTS "scholarship_rule_plantel_idx"
  ON "recalc_admin"."scholarship_rule" ("plantel");
