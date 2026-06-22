import { describe, expect, it } from "vitest";

import { inspectPriceCoverage, type PriceCoverageContext } from "../price-coverage-report";

const context = {
  offeringId: "offering-1",
  cycle: "C3",
  businessLine: "licenciatura",
  modality: "presencial",
  programId: "program-1",
  programName: "Psicología",
  campusId: "campus-1",
  campusKey: "HERMOSILLO",
  campusName: "Hermosillo",
  campusTier: "T1",
  pricingPlans: [9],
  module: "M1",
} satisfies PriceCoverageContext;

describe("price coverage report", () => {
  it("detecta una oferta activa sin precio lista resoluble", () => {
    const report = inspectPriceCoverage({ contexts: [context], overrides: [] });

    expect(report).toMatchObject({
      offeringsChecked: 1,
      combinationsChecked: 1,
      coveredCombinations: 0,
      issues: [expect.objectContaining({ kind: "missing_base_price", plan: 9 })],
    });
  });

  it("considera cubierta una combinación con el mismo matcher canónico", () => {
    const report = inspectPriceCoverage({
      contexts: [context],
      overrides: [
        {
          id: "price-1",
          scope: "base_price",
          targetKeys: {
            nivel_key: "licenciatura",
            modalidad_key: "presencial",
            plan: "9",
            modulo: "M1",
            plantel: "Hermosillo",
            programa_key: "Psicología",
            tier: "T1",
          },
          newPrice: 3500,
          isActive: true,
          notes: null,
          updatedBy: "test@example.com",
        },
      ],
    });

    expect(report).toMatchObject({
      offeringsChecked: 1,
      combinationsChecked: 1,
      coveredCombinations: 1,
      issues: [],
    });
  });

  it("reporta ofertas sin planes de precio", () => {
    const report = inspectPriceCoverage({
      contexts: [{ ...context, pricingPlans: [] }],
      overrides: [],
    });

    expect(report.issues).toEqual([
      expect.objectContaining({ kind: "offering_without_pricing_plan", plan: null }),
    ]);
  });
});
