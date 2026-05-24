import type { QuoteCalculationInput, QuoteCalculationResult } from "@relead/domain/calculator/types";

export function runQuoteEngine(input: QuoteCalculationInput): QuoteCalculationResult {
  const sinAccessToScholarship = input.average < 7;
  const scholarshipPercent = sinAccessToScholarship ? 0 : input.scholarshipPercent;
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
    subtotalMxn,
    totalMxn,
    sinAccessToScholarship,
  };
}
