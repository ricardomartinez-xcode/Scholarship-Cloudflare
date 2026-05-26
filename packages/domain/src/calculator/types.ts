export type EnrollmentType = "nuevo_ingreso" | "reingreso" | "regreso";

export type QuoteCalculationInput = {
  enrollmentType: EnrollmentType;
  businessLine: string;
  modality: string;
  plan: number;
  campus?: string | null;
  average: number;
  basePriceMxn: number;
  scholarshipPercent: number;
  additionalBenefitPercent?: number;
  extraChargeAmount?: number;
};

export type QuoteCalculationResult = {
  basePriceMxn: number;
  scholarshipPercent: number;
  scholarshipAmountMxn: number;
  additionalBenefitPercent: number;
  additionalBenefitAmountMxn: number;
  subtotalMxn: number;
  totalMxn: number;
  sinAccessToScholarship: boolean;
};

export type CanonicalQuoteRequest = {
  enrollmentType: EnrollmentType;
  businessLine: string;
  modality: string;
  plan: number;
  campus?: string | null;
  average: number;
  subjectCount?: number | null;
  extraChargeAmount?: number;
  selectedProgramId?: string | null;
  selectedProgramName?: string | null;
  offeringId?: string | null;
  offerCycle?: string | null;
  sourceVersion?: string;
};
