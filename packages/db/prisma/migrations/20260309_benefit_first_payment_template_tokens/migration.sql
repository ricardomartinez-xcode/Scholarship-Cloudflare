DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'recalc_admin' AND t.typname = 'AdminAdditionalBenefitType'
  ) THEN
    CREATE TYPE "recalc_admin"."AdminAdditionalBenefitType" AS ENUM (
      'percentage',
      'first_payment'
    );
  END IF;
END $$;

ALTER TABLE "recalc_admin"."admin_additional_benefit"
  ADD COLUMN IF NOT EXISTS "benefitType" "recalc_admin"."AdminAdditionalBenefitType" NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS "enrollmentType" "recalc_admin"."EnrollmentType",
  ADD COLUMN IF NOT EXISTS "firstPaymentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "recalc_admin"."admin_additional_benefit"
SET
  "benefitType" = COALESCE("benefitType", 'percentage'::"recalc_admin"."AdminAdditionalBenefitType"),
  "firstPaymentAmount" = COALESCE("firstPaymentAmount", 0)
WHERE
  "benefitType" IS NULL
  OR "firstPaymentAmount" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_additional_benefit_first_payment_nonnegative_ck'
  ) THEN
    ALTER TABLE "recalc_admin"."admin_additional_benefit"
      ADD CONSTRAINT "admin_additional_benefit_first_payment_nonnegative_ck"
      CHECK ("firstPaymentAmount" >= 0);
  END IF;
END $$;

ALTER TABLE "recalc_admin"."quote_scenario"
  ADD COLUMN IF NOT EXISTS "firstPaymentAmountMxn" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "recalc_admin"."quote_scenario"
SET "firstPaymentAmountMxn" = COALESCE("firstPaymentAmountMxn", 0)
WHERE "firstPaymentAmountMxn" IS NULL;
