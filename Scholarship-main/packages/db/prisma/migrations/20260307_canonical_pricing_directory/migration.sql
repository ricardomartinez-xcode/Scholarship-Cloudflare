DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'EnrollmentType'
  ) THEN
    CREATE TYPE "recalc_admin"."EnrollmentType" AS ENUM ('nuevo_ingreso', 'regreso', 'reingreso');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'CanonicalModality'
  ) THEN
    CREATE TYPE "recalc_admin"."CanonicalModality" AS ENUM ('presencial', 'mixta', 'online');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'DirectoryContactMethodType'
  ) THEN
    CREATE TYPE "recalc_admin"."DirectoryContactMethodType" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP', 'URL', 'OTHER');
  END IF;
END $$;

CREATE TABLE "recalc_admin"."directory_contact_method" (
  "id" UUID NOT NULL,
  "directoryContactId" UUID NOT NULL,
  "type" "recalc_admin"."DirectoryContactMethodType" NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "directory_contact_method_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recalc_admin"."scholarship_rule" (
  "id" UUID NOT NULL,
  "enrollmentType" "recalc_admin"."EnrollmentType" NOT NULL,
  "businessLine" "recalc_admin"."BenefitBusinessLine" NOT NULL,
  "modality" "recalc_admin"."CanonicalModality" NOT NULL,
  "plan" INTEGER NOT NULL,
  "campusTier" TEXT NOT NULL DEFAULT 'ANY',
  "minAverage" DECIMAL(4,2),
  "maxAverage" DECIMAL(4,2),
  "scholarshipPercent" DECIMAL(5,2),
  "discountedPriceMxn" DECIMAL(12,2),
  "origin" TEXT,
  "legacyRowId" BIGINT,
  "sourceVersion" TEXT NOT NULL DEFAULT 'legacy',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "scholarship_rule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recalc_admin"."return_subject_price" (
  "id" UUID NOT NULL,
  "campusId" UUID NOT NULL,
  "modality" "recalc_admin"."CanonicalModality" NOT NULL,
  "subjectCount" INTEGER NOT NULL,
  "priceMxn" DECIMAL(12,2) NOT NULL,
  "legacyPlantelRaw" TEXT,
  "legacyModalityRaw" TEXT,
  "sourceVersion" TEXT NOT NULL DEFAULT 'legacy',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "return_subject_price_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "directory_contact_method_unique_value_idx"
ON "recalc_admin"."directory_contact_method"("directoryContactId", "type", "normalizedValue");

CREATE INDEX "directory_contact_method_contact_sort_idx"
ON "recalc_admin"."directory_contact_method"("directoryContactId", "sortOrder");

CREATE INDEX "directory_contact_method_type_normalized_idx"
ON "recalc_admin"."directory_contact_method"("type", "normalizedValue");

CREATE UNIQUE INDEX "scholarship_rule_legacyRowId_key"
ON "recalc_admin"."scholarship_rule"("legacyRowId");

CREATE UNIQUE INDEX "scholarship_rule_runtime_key"
ON "recalc_admin"."scholarship_rule"(
  "enrollmentType",
  "businessLine",
  "modality",
  "plan",
  "campusTier",
  "minAverage",
  "maxAverage",
  "sourceVersion"
);

CREATE INDEX "scholarship_rule_lookup_idx"
ON "recalc_admin"."scholarship_rule"("businessLine", "modality", "plan");

CREATE INDEX "scholarship_rule_source_enrollment_idx"
ON "recalc_admin"."scholarship_rule"("sourceVersion", "enrollmentType");

CREATE UNIQUE INDEX "return_subject_price_runtime_key"
ON "recalc_admin"."return_subject_price"("campusId", "modality", "subjectCount", "sourceVersion");

CREATE INDEX "return_subject_price_lookup_idx"
ON "recalc_admin"."return_subject_price"("campusId", "modality");

ALTER TABLE "recalc_admin"."directory_contact_method"
ADD CONSTRAINT "directory_contact_method_directoryContactId_fkey"
FOREIGN KEY ("directoryContactId") REFERENCES "recalc_admin"."directory_contact"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recalc_admin"."return_subject_price"
ADD CONSTRAINT "return_subject_price_campusId_fkey"
FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
