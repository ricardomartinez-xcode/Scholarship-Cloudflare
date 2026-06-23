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

  it("resuelve aliases de campus y programa con el matcher compartido", () => {
    const report = inspectPriceCoverage({
      contexts: [
        {
          ...context,
          campusAliases: ["campus-1", "HMO", "campus-hermosillo"],
          programAliases: [
            "program-1",
            "Psicología",
            "Licenciatura en Psicología",
          ],
        },
      ],
      overrides: [
        {
          id: "price-alias",
          scope: "base_price",
          targetKeys: {
            nivel_key: "licenciatura",
            modalidad_key: "presencial",
            plan: "9",
            modulo: "M1",
            plantel: "HMO",
            programa_key: "Licenciatura en Psicologia",
            tier: "T1",
          },
          newPrice: 3500,
          isActive: true,
          notes: null,
          updatedBy: "test@example.com",
        },
      ],
    });

    expect(report.coveredCombinations).toBe(1);
    expect(report.issues).toEqual([]);
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

  it("ordena de forma determinista incidencias resolubles y no resolubles", () => {
    const report = inspectPriceCoverage({
      contexts: [context],
      overrides: [],
      unresolvedIssues: [
        {
          kind: "unresolvable_offering_context",
          offeringId: "offering-2",
          cycle: "C4",
          campus: "Zacatecas",
          program: "Programa sin línea",
          businessLine: null,
          modality: null,
          plan: null,
          module: "M1",
          tier: null,
          message:
            "La oferta activa no tiene línea o modalidad canónica resoluble.",
        },
      ],
    });

    expect(report.offeringsChecked).toBe(2);
    expect(report.issues.map((issue) => issue.kind)).toEqual([
      "missing_base_price",
      "unresolvable_offering_context",
    ]);
  });
});
