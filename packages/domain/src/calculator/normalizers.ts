import {
  normalizeBusinessLine,
  normalizeCanonicalModality,
  normalizeEnrollmentType,
} from "@/lib/pricing-normalize";

export function normalizeQuoteInput(input: {
  enrollmentType?: string;
  businessLine?: string;
  modality?: string;
}) {
  return {
    enrollmentType: normalizeEnrollmentType(input.enrollmentType),
    businessLine: normalizeBusinessLine(input.businessLine),
    modality: normalizeCanonicalModality(input.modality),
  };
}
