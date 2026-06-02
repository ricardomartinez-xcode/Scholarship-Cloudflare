ALTER TABLE "recalc_admin"."program_offering"
  ADD COLUMN IF NOT EXISTS "subjects_by_module" TEXT;

UPDATE "recalc_admin"."program_offering"
SET "track" = 'Longitudinal'
WHERE "track" IS NULL OR btrim("track") = '';

ALTER TABLE "recalc_admin"."program_offering"
  ALTER COLUMN "track" SET DEFAULT 'Longitudinal';

ALTER TABLE "recalc_admin"."program_offering"
  DROP CONSTRAINT IF EXISTS "program_offering_campusId_programId_cycle_key";

ALTER TABLE "recalc_admin"."program_offering"
  ADD CONSTRAINT "program_offering_campusId_programId_cycle_track_key"
  UNIQUE ("campusId", "programId", "cycle", "track");

CREATE INDEX IF NOT EXISTS "program_offering_cycle_track_idx"
  ON "recalc_admin"."program_offering" ("cycle", "track");
