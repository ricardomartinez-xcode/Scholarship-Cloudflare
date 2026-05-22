-- Academic Offer import: programs + offerings (cycle-scoped, replaceable).

-- Ensure schema exists.
CREATE SCHEMA IF NOT EXISTS "recalc_admin";

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'ProgramOfferingDelivery'
  ) THEN
    CREATE TYPE "recalc_admin"."ProgramOfferingDelivery" AS ENUM ('CAMPUS', 'ONLINE');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "recalc_admin"."program" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "nameNormalized" TEXT NOT NULL,
  "level" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "program_pkey" PRIMARY KEY ("id")
);

-- Indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'program_nameNormalized_key'
  ) THEN
    CREATE UNIQUE INDEX "program_nameNormalized_key" ON "recalc_admin"."program"("nameNormalized");
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "recalc_admin"."program_offering" (
  "id" UUID NOT NULL,
  "campusId" UUID NOT NULL,
  "programId" UUID NOT NULL,
  "cycle" TEXT NOT NULL,
  "delivery" "recalc_admin"."ProgramOfferingDelivery" NOT NULL DEFAULT 'CAMPUS',
  "escolarizado" BOOLEAN NOT NULL DEFAULT false,
  "ejecutivo" BOOLEAN NOT NULL DEFAULT false,
  "escolarizadoSchedule" TEXT,
  "ejecutivoSchedule" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "archivedReason" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "program_offering_pkey" PRIMARY KEY ("id")
);

-- Constraints (unique + FKs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offering_campusId_programId_cycle_key'
  ) THEN
    ALTER TABLE "recalc_admin"."program_offering"
      ADD CONSTRAINT "program_offering_campusId_programId_cycle_key"
      UNIQUE ("campusId","programId","cycle");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offering_campusId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."program_offering"
      ADD CONSTRAINT "program_offering_campusId_fkey"
      FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offering_programId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."program_offering"
      ADD CONSTRAINT "program_offering_programId_fkey"
      FOREIGN KEY ("programId") REFERENCES "recalc_admin"."program"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'program_offering_campusId_cycle_idx'
  ) THEN
    CREATE INDEX "program_offering_campusId_cycle_idx" ON "recalc_admin"."program_offering"("campusId","cycle");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'recalc_admin' AND indexname = 'program_offering_cycle_isActive_idx'
  ) THEN
    CREATE INDEX "program_offering_cycle_isActive_idx" ON "recalc_admin"."program_offering"("cycle","isActive");
  END IF;
END $$;

