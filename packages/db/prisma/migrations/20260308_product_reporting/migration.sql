DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'QuoteScenarioKind'
  ) THEN
    CREATE TYPE "recalc_admin"."QuoteScenarioKind" AS ENUM ('DRAFT', 'SAVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'BusinessEventType'
  ) THEN
    CREATE TYPE "recalc_admin"."BusinessEventType" AS ENUM (
      'QUOTE_SIMULATED',
      'QUOTE_SCENARIO_SAVED',
      'QUOTE_SCENARIO_LOADED',
      'QUOTE_COMPARISON_VIEWED',
      'CTA_CLICKED',
      'BENEFIT_APPLIED',
      'IMPORT_VALIDATED',
      'IMPORT_APPLIED',
      'IMPORT_ROLLED_BACK'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'ProgramAssetType'
  ) THEN
    CREATE TYPE "recalc_admin"."ProgramAssetType" AS ENUM (
      'PLAN_PDF',
      'BROCHURE_PDF',
      'PLAN_URL',
      'PLAN_DRIVE_LINK'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'ProgramAssetStatus'
  ) THEN
    CREATE TYPE "recalc_admin"."ProgramAssetStatus" AS ENUM (
      'healthy',
      'broken',
      'timeout',
      'unauthorized',
      'skipped'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "recalc_admin"."quote_session" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "publicId" TEXT NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "quoteMode" TEXT NOT NULL,
  "lastOpenedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "quote_session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recalc_admin"."quote_scenario" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "quoteSessionId" UUID NOT NULL,
  "kind" "recalc_admin"."QuoteScenarioKind" NOT NULL DEFAULT 'DRAFT',
  "label" TEXT NOT NULL,
  "inputFingerprint" TEXT NOT NULL,
  "inputJson" JSONB NOT NULL,
  "resultJson" JSONB NOT NULL,
  "enrollmentType" "recalc_admin"."EnrollmentType" NOT NULL,
  "businessLine" "recalc_admin"."BenefitBusinessLine" NOT NULL,
  "modality" "recalc_admin"."CanonicalModality" NOT NULL,
  "plan" INTEGER NOT NULL,
  "campusId" UUID,
  "campusNameSnapshot" TEXT,
  "programId" UUID,
  "programNameSnapshot" TEXT,
  "average" DECIMAL(4,2) NOT NULL,
  "subjectCount" INTEGER,
  "extraChargeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "basePriceMxn" DECIMAL(12,2) NOT NULL,
  "scholarshipPercent" DECIMAL(5,2) NOT NULL,
  "scholarshipAmountMxn" DECIMAL(12,2) NOT NULL,
  "additionalBenefitPercent" DECIMAL(5,2) NOT NULL,
  "additionalBenefitAmountMxn" DECIMAL(12,2) NOT NULL,
  "subtotalMxn" DECIMAL(12,2) NOT NULL,
  "totalMxn" DECIMAL(12,2) NOT NULL,
  "sinAccessToScholarship" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "quote_scenario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recalc_admin"."business_event" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "recalc_admin"."BusinessEventType" NOT NULL,
  "userId" UUID,
  "quoteSessionId" UUID,
  "quoteScenarioId" UUID,
  "subjectType" TEXT,
  "subjectId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "business_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recalc_admin"."program_asset_check" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "programId" UUID NOT NULL,
  "assetType" "recalc_admin"."ProgramAssetType" NOT NULL,
  "url" TEXT NOT NULL,
  "status" "recalc_admin"."ProgramAssetStatus" NOT NULL,
  "httpStatus" INTEGER,
  "contentType" TEXT,
  "error" TEXT,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "program_asset_check_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quote_session_publicId_key"
ON "recalc_admin"."quote_session"("publicId");

CREATE INDEX IF NOT EXISTS "quote_session_owner_updated_idx"
ON "recalc_admin"."quote_session"("ownerUserId", "updatedAt");

CREATE INDEX IF NOT EXISTS "quote_scenario_session_kind_updated_idx"
ON "recalc_admin"."quote_scenario"("quoteSessionId", "kind", "updatedAt");

CREATE INDEX IF NOT EXISTS "quote_scenario_campus_updated_idx"
ON "recalc_admin"."quote_scenario"("campusId", "updatedAt");

CREATE INDEX IF NOT EXISTS "quote_scenario_program_updated_idx"
ON "recalc_admin"."quote_scenario"("programId", "updatedAt");

CREATE INDEX IF NOT EXISTS "quote_scenario_fingerprint_idx"
ON "recalc_admin"."quote_scenario"("inputFingerprint");

WITH ranked_drafts AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "quoteSessionId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS row_num
  FROM "recalc_admin"."quote_scenario"
  WHERE "kind" = 'DRAFT'
)
UPDATE "recalc_admin"."quote_scenario" AS scenario
SET "kind" = 'SAVED'
FROM ranked_drafts
WHERE scenario."id" = ranked_drafts."id"
  AND ranked_drafts.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "quote_scenario_single_draft_per_session_idx"
ON "recalc_admin"."quote_scenario"("quoteSessionId")
WHERE "kind" = 'DRAFT';

CREATE INDEX IF NOT EXISTS "business_event_type_created_idx"
ON "recalc_admin"."business_event"("type", "createdAt");

CREATE INDEX IF NOT EXISTS "business_event_session_created_idx"
ON "recalc_admin"."business_event"("quoteSessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "business_event_scenario_created_idx"
ON "recalc_admin"."business_event"("quoteScenarioId", "createdAt");

CREATE INDEX IF NOT EXISTS "business_event_subject_created_idx"
ON "recalc_admin"."business_event"("subjectType", "subjectId", "createdAt");

CREATE INDEX IF NOT EXISTS "business_event_user_created_idx"
ON "recalc_admin"."business_event"("userId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "program_asset_check_program_asset_type_key"
ON "recalc_admin"."program_asset_check"("programId", "assetType");

CREATE INDEX IF NOT EXISTS "program_asset_check_status_checked_idx"
ON "recalc_admin"."program_asset_check"("status", "checkedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quote_session_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."quote_session"
    ADD CONSTRAINT "quote_session_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quote_scenario_quoteSessionId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."quote_scenario"
    ADD CONSTRAINT "quote_scenario_quoteSessionId_fkey"
    FOREIGN KEY ("quoteSessionId") REFERENCES "recalc_admin"."quote_session"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quote_scenario_campusId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."quote_scenario"
    ADD CONSTRAINT "quote_scenario_campusId_fkey"
    FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quote_scenario_programId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."quote_scenario"
    ADD CONSTRAINT "quote_scenario_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "recalc_admin"."program"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_event_quoteSessionId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."business_event"
    ADD CONSTRAINT "business_event_quoteSessionId_fkey"
    FOREIGN KEY ("quoteSessionId") REFERENCES "recalc_admin"."quote_session"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_event_quoteScenarioId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."business_event"
    ADD CONSTRAINT "business_event_quoteScenarioId_fkey"
    FOREIGN KEY ("quoteScenarioId") REFERENCES "recalc_admin"."quote_scenario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'program_asset_check_programId_fkey'
  ) THEN
    ALTER TABLE "recalc_admin"."program_asset_check"
    ADD CONSTRAINT "program_asset_check_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "recalc_admin"."program"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
