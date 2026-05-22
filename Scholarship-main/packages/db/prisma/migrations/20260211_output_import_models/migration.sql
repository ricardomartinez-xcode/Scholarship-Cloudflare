-- Import _output models: Campus slug/tier, Program plan links, offerings scope, directory contacts, bulletins.
-- Idempotent migration for existing recalc_admin schema.

CREATE SCHEMA IF NOT EXISTS "recalc_admin";

ALTER TABLE "recalc_admin"."campus"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "tier" TEXT;

UPDATE "recalc_admin"."campus"
SET "slug" = lower(replace("code", '_', '-'))
WHERE "slug" IS NULL OR btrim("slug") = '';

ALTER TABLE "recalc_admin"."campus"
  ALTER COLUMN "slug" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'campus_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "campus_slug_key" ON "recalc_admin"."campus"("slug");
  END IF;
END $$;

ALTER TABLE "recalc_admin"."program"
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "planDriveFileId" TEXT,
  ADD COLUMN IF NOT EXISTS "planDriveLink" TEXT,
  ADD COLUMN IF NOT EXISTS "planUrl" TEXT;

ALTER TABLE "recalc_admin"."program_offering"
  ADD COLUMN IF NOT EXISTS "track" TEXT,
  ADD COLUMN IF NOT EXISTS "lineOfBusiness" TEXT;

CREATE TABLE IF NOT EXISTS "recalc_admin"."directory_contact" (
  "id" UUID NOT NULL,
  "campusId" UUID NOT NULL,
  "zone" TEXT,
  "role" TEXT,
  "name" TEXT,
  "email" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "directory_contact_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'directory_contact_campusId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."directory_contact"
      ADD CONSTRAINT "directory_contact_campusId_fkey"
      FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'directory_contact_campus_role_idx'
  ) THEN
    CREATE INDEX "directory_contact_campus_role_idx"
      ON "recalc_admin"."directory_contact"("campusId","role");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "recalc_admin"."bulletin" (
  "id" UUID NOT NULL,
  "campusId" UUID NOT NULL,
  "cycle" TEXT,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bulletin_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bulletin_campusId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."bulletin"
      ADD CONSTRAINT "bulletin_campusId_fkey"
      FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'bulletin_campus_cycle_idx'
  ) THEN
    CREATE INDEX "bulletin_campus_cycle_idx"
      ON "recalc_admin"."bulletin"("campusId","cycle");
  END IF;
END $$;
