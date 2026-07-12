-- PostgreSQL constraints and partial indexes that Prisma cannot represent in
-- its schema but that protect quote, pricing, benefit and template workflows.
BEGIN;

ALTER TABLE recalc_admin.admin_additional_benefit
  ADD CONSTRAINT admin_additional_benefit_values_valid CHECK (
    (
      "benefitType" = 'percentage'
      AND "extraPercent" > 0
      AND "extraPercent" <= 100
      AND "firstPaymentAmount" >= 0
    )
    OR (
      "benefitType" = 'first_payment'
      AND "extraPercent" = 0
      AND "firstPaymentAmount" > 0
    )
    OR (
      "benefitType" = 'fixed_scholarship'
      AND "extraPercent" = 0
      AND "firstPaymentAmount" >= 0
    )
  );

ALTER TABLE recalc_admin.admin_price_override
  ADD CONSTRAINT admin_price_override_new_price_nonnegative_ck
  CHECK ("newPrice" >= 0);

ALTER TABLE recalc_admin.quote_scenario
  ADD CONSTRAINT quote_scenario_average_range_ck
  CHECK (average >= 0 AND average <= 10),
  ADD CONSTRAINT quote_scenario_subject_count_positive_ck
  CHECK ("subjectCount" IS NULL OR "subjectCount" > 0);

ALTER TABLE recalc_admin.return_subject_price
  ADD CONSTRAINT return_subject_price_values_positive_ck
  CHECK ("subjectCount" > 0 AND "priceMxn" >= 0);

CREATE UNIQUE INDEX quote_scenario_single_draft_per_session_idx
  ON recalc_admin.quote_scenario("quoteSessionId")
  WHERE kind = 'DRAFT';

CREATE UNIQUE INDEX whatsapp_template_default_official_unique_idx
  ON recalc_admin.whatsapp_template("isDefaultOfficial")
  WHERE status = 'official' AND "isDefaultOfficial" = true;

CREATE INDEX admin_price_override_scope_active_idx
  ON recalc_admin.admin_price_override(scope, "isActive");

CREATE INDEX invite_cancelled_at_idx
  ON recalc_admin.invite("cancelledAt")
  WHERE "cancelledAt" IS NOT NULL;

COMMIT;
