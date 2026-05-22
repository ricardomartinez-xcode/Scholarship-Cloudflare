-- UNIDEP features migration:
-- 1. Add address/phone/whatsapp to Campus
-- 2. Add businessLine/planPdfUrl/brochurePdfUrl to Program
-- 3. Create AcademicFeeSection enum
-- 4. Create AcademicFee table
-- 5. Create CampusAcademicFee join table
-- Idempotent migration for existing recalc_admin schema.

CREATE SCHEMA IF NOT EXISTS "recalc_admin";

-- 1. Campus: add contact fields
ALTER TABLE "recalc_admin"."campus"
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsapp" TEXT;

-- 2. Program: add businessLine enum and PDF URL fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin'
      AND t.typname = 'BenefitBusinessLine'
  ) THEN
    CREATE TYPE "recalc_admin"."BenefitBusinessLine" AS ENUM ('salud', 'licenciatura', 'prepa', 'posgrado');
  END IF;
END $$;

ALTER TABLE "recalc_admin"."program"
  ADD COLUMN IF NOT EXISTS "businessLine" "recalc_admin"."BenefitBusinessLine",
  ADD COLUMN IF NOT EXISTS "planPdfUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "brochurePdfUrl" TEXT;

-- 3. Create AcademicFeeSection enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin'
      AND t.typname = 'AcademicFeeSection'
  ) THEN
    CREATE TYPE "recalc_admin"."AcademicFeeSection" AS ENUM ('EXAMENES', 'TRAMITES', 'DIVERSOS');
  END IF;
END $$;

-- 4. Create AcademicFee table
CREATE TABLE IF NOT EXISTS "recalc_admin"."academic_fee" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "concept" TEXT NOT NULL,
  "costMxn" INTEGER NOT NULL,
  "section" "recalc_admin"."AcademicFeeSection" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_fee_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'academic_fee_code_key'
  ) THEN
    CREATE UNIQUE INDEX "academic_fee_code_key" ON "recalc_admin"."academic_fee"("code");
  END IF;
END $$;

-- 5. Create CampusAcademicFee join table
CREATE TABLE IF NOT EXISTS "recalc_admin"."campus_academic_fee" (
  "id" UUID NOT NULL,
  "campusId" UUID NOT NULL,
  "academicFeeId" UUID NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "overrideCostMxn" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campus_academic_fee_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'campus_academic_fee_campusId_academicFeeId_key'
  ) THEN
    CREATE UNIQUE INDEX "campus_academic_fee_campusId_academicFeeId_key"
      ON "recalc_admin"."campus_academic_fee"("campusId", "academicFeeId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'campus_academic_fee_campusId_idx'
  ) THEN
    CREATE INDEX "campus_academic_fee_campusId_idx"
      ON "recalc_admin"."campus_academic_fee"("campusId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campus_academic_fee_campusId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."campus_academic_fee"
      ADD CONSTRAINT "campus_academic_fee_campusId_fkey"
      FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campus_academic_fee_academicFeeId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."campus_academic_fee"
      ADD CONSTRAINT "campus_academic_fee_academicFeeId_fkey"
      FOREIGN KEY ("academicFeeId") REFERENCES "recalc_admin"."academic_fee"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
