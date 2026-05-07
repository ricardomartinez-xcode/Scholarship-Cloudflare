-- Add canonical campus catalog (24 campus + Online) and normalize AdminAdditionalBenefit campus selection.
-- Notes:
-- - We intentionally keep legacy column recalc_admin.admin_additional_benefit."campusIds" (TEXT[])
--   if it exists, to avoid destructive changes. New code uses the join table below.

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'recalc_admin' AND t.typname = 'CampusKind') THEN
    CREATE TYPE "recalc_admin"."CampusKind" AS ENUM ('campus', 'online');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "recalc_admin"."campus" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "metaKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "recalc_admin"."CampusKind" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campus_pkey" PRIMARY KEY ("id")
);

-- Indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'campus_code_key'
  ) THEN
    CREATE UNIQUE INDEX "campus_code_key" ON "recalc_admin"."campus"("code");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'campus_metaKey_key'
  ) THEN
    CREATE UNIQUE INDEX "campus_metaKey_key" ON "recalc_admin"."campus"("metaKey");
  END IF;
END $$;

-- AlterTable
ALTER TABLE "recalc_admin"."admin_additional_benefit"
  ADD COLUMN IF NOT EXISTS "appliesToAll" BOOLEAN NOT NULL DEFAULT false;

-- Join table
CREATE TABLE IF NOT EXISTS "recalc_admin"."admin_additional_benefit_campus" (
  "benefitId" UUID NOT NULL,
  "campusId" UUID NOT NULL,
  CONSTRAINT "admin_additional_benefit_campus_pkey" PRIMARY KEY ("benefitId","campusId")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_additional_benefit_campus_benefitId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."admin_additional_benefit_campus"
      ADD CONSTRAINT "admin_additional_benefit_campus_benefitId_fkey"
      FOREIGN KEY ("benefitId") REFERENCES "recalc_admin"."admin_additional_benefit"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_additional_benefit_campus_campusId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."admin_additional_benefit_campus"
      ADD CONSTRAINT "admin_additional_benefit_campus_campusId_fkey"
      FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- M3: CTA location
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'recalc_admin' AND t.typname = 'AdminPublicCtaLocation') THEN
    CREATE TYPE "recalc_admin"."AdminPublicCtaLocation" AS ENUM ('HOME_PRIMARY', 'HOME_SECONDARY');
  END IF;
END $$;

ALTER TABLE "recalc_admin"."admin_public_cta"
  ADD COLUMN IF NOT EXISTS "location" "recalc_admin"."AdminPublicCtaLocation" NOT NULL DEFAULT 'HOME_PRIMARY';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'admin_public_cta_location_sortOrder_idx'
  ) THEN
    CREATE INDEX "admin_public_cta_location_sortOrder_idx" ON "recalc_admin"."admin_public_cta"("location","sortOrder");
  END IF;
END $$;
