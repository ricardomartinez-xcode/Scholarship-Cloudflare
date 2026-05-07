import { describe, expect, it } from "vitest";

import { CalculatorValidationError, CalculatorNotFoundError } from "@relead/domain/calculator/errors";
import { resolveCanonicalQuote } from "@relead/domain/calculator/quote-service";

describe("calculator quote service", () => {
  it("rechaza promedio inválido", async () => {
    await expect(
      resolveCanonicalQuote(
        {
          enrollmentType: "nuevo_ingreso",
          businessLine: "licenciatura",
          modality: "online",
          plan: 1,
          average: 12,
        },
        {
          resolveCanonicalQuote: async () => ({ ok: false, source: "canonical", error: "x" }),
        },
      ),
    ).rejects.toBeInstanceOf(CalculatorValidationError);
  });

  it("propaga combinación no encontrada", async () => {
    await expect(resolveCanonicalQuote(
      {
        enrollmentType: "nuevo_ingreso",
        businessLine: "licenciatura",
        modality: "online",
        plan: 1,
        average: 8.5,
      },
      {
        resolveCanonicalQuote: async () => {
          throw new CalculatorNotFoundError();
        },
      },
    )).rejects.toBeInstanceOf(CalculatorNotFoundError);
  });
});
