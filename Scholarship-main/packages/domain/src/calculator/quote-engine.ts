import type { QuoteCalculationInput, QuoteCalculationResult } from "@relead/domain/calculator/types";

const MAX_REGRESO_BENEFIT = 25;

export function runQuoteEngine(input: QuoteCalculationInput): QuoteCalculationResult {
  const fixedScholarshipPercent = input.fixedScholarshipPercent ?? 0;
  const usesFixedScholarship = fixedScholarshipPercent > 0;
  const sinAccessToScholarship = input.average < 7 && !usesFixedScholarship;
  const boundedScholarship = usesFixedScholarship
    ? fixedScholarshipPercent
    : input.enrollmentType === "nuevo_ingreso"
      ? input.scholarshipPercent
      : Math.min(input.scholarshipPercent, MAX_REGRESO_BENEFIT);
  const scholarshipPercent = sinAccessToScholarship ? 0 : boundedScholarship;
  const additionalBenefitPercent = input.additionalBenefitPercent ?? 0;

  const scholarshipAmountMxn = input.basePriceMxn * (scholarshipPercent / 100);
  const additionalBenefitAmountMxn = input.basePriceMxn * (additionalBenefitPercent / 100);
  const subtotalMxn = input.basePriceMxn - scholarshipAmountMxn - additionalBenefitAmountMxn;
  const totalMxn = subtotalMxn + (input.extraChargeAmount ?? 0);

  return {
    basePriceMxn: input.basePriceMxn,
    scholarshipPercent,
    scholarshipAmountMxn,
    additionalBenefitPercent,
    additionalBenefitAmountMxn,
    fixedScholarshipPercent: usesFixedScholarship ? fixedScholarshipPercent : 0,
    scholarshipSource: sinAccessToScholarship ? "none" : usesFixedScholarship ? "fixed" : "average",
    subtotalMxn,
    totalMxn,
    sinAccessToScholarship,
  };
}
