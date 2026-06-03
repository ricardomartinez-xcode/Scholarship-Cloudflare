ALTER TABLE "recalc_admin"."program_offering"
  ADD COLUMN IF NOT EXISTS "module_count" INTEGER;

UPDATE "recalc_admin"."program_offering"
SET "module_count" = CAST(substring("subjects_by_module" FROM '\d+') AS INTEGER)
WHERE "module_count" IS NULL
  AND "subjects_by_module" ~ '\d+';
