import { CalculatorValidationError } from "@relead/domain/calculator/errors";
import type { CanonicalQuoteRequest } from "@relead/domain/calculator/types";

export function validateCanonicalQuoteRequest(input: CanonicalQuoteRequest) {
  const invalid: string[] = [];
  if (!Number.isInteger(input.plan) || input.plan <= 0) invalid.push("plan");
  if (input.average < 0 || input.average > 10) invalid.push("average");
  if (
    input.subjectCount !== undefined &&
    input.subjectCount !== null &&
    (!Number.isInteger(input.subjectCount) || input.subjectCount <= 0)
  ) {
    invalid.push("subjectCount");
  }
  if ((input.extraChargeAmount ?? 0) < 0) invalid.push("extraChargeAmount");

  if (invalid.length) {
    throw new CalculatorValidationError("Solicitud de cotización inválida.", { invalid });
  }
}
