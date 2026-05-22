DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin'
      AND t.typname = 'BusinessEventType'
      AND e.enumlabel = 'QUOTE_GENERATED'
  ) THEN
    ALTER TYPE "recalc_admin"."BusinessEventType" ADD VALUE 'QUOTE_GENERATED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin'
      AND t.typname = 'BusinessEventType'
      AND e.enumlabel = 'INVITE_CREATED'
  ) THEN
    ALTER TYPE "recalc_admin"."BusinessEventType" ADD VALUE 'INVITE_CREATED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin'
      AND t.typname = 'BusinessEventType'
      AND e.enumlabel = 'INVITE_RESENT'
  ) THEN
    ALTER TYPE "recalc_admin"."BusinessEventType" ADD VALUE 'INVITE_RESENT';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin'
      AND t.typname = 'BusinessEventType'
      AND e.enumlabel = 'OFFER_PUBLISHED'
  ) THEN
    ALTER TYPE "recalc_admin"."BusinessEventType" ADD VALUE 'OFFER_PUBLISHED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin'
      AND t.typname = 'BusinessEventType'
      AND e.enumlabel = 'IMPORT_FAILED'
  ) THEN
    ALTER TYPE "recalc_admin"."BusinessEventType" ADD VALUE 'IMPORT_FAILED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_additional_benefit_extra_percent_range_ck'
  ) THEN
    ALTER TABLE "recalc_admin"."admin_additional_benefit"
    ADD CONSTRAINT "admin_additional_benefit_extra_percent_range_ck"
    CHECK ("extraPercent" > 0 AND "extraPercent" <= 100) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_price_override_new_price_nonnegative_ck'
  ) THEN
    ALTER TABLE "recalc_admin"."admin_price_override"
    ADD CONSTRAINT "admin_price_override_new_price_nonnegative_ck"
    CHECK ("newPrice" >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quote_scenario_average_range_ck'
  ) THEN
    ALTER TABLE "recalc_admin"."quote_scenario"
    ADD CONSTRAINT "quote_scenario_average_range_ck"
    CHECK ("average" >= 0 AND "average" <= 10) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quote_scenario_subject_count_positive_ck'
  ) THEN
    ALTER TABLE "recalc_admin"."quote_scenario"
    ADD CONSTRAINT "quote_scenario_subject_count_positive_ck"
    CHECK ("subjectCount" IS NULL OR "subjectCount" > 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'return_subject_price_subject_count_positive_ck'
  ) THEN
    ALTER TABLE "recalc_admin"."return_subject_price"
    ADD CONSTRAINT "return_subject_price_subject_count_positive_ck"
    CHECK ("subjectCount" > 0 AND "priceMxn" >= 0) NOT VALID;
  END IF;
END $$;
