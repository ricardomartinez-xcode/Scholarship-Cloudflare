ALTER TABLE "recalc_admin"."admin_additional_benefit"
DROP CONSTRAINT IF EXISTS "admin_additional_benefit_extra_percent_range_ck";

ALTER TABLE "recalc_admin"."admin_additional_benefit"
ADD CONSTRAINT "admin_additional_benefit_extra_percent_range_ck"
CHECK (
  (
    "benefitType" = 'percentage'::"recalc_admin"."AdminAdditionalBenefitType"
    AND "extraPercent" > 0
    AND "extraPercent" <= 100
  )
  OR (
    "benefitType" = 'first_payment'::"recalc_admin"."AdminAdditionalBenefitType"
    AND "extraPercent" = 0
  )
) NOT VALID;
