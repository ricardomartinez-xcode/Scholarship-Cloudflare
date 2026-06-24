import { describe, expect, it } from "vitest";

import { assertProjectedPriceImportCoverage } from "../price-import-integrity-guard";

const coverageInputs = {
  contexts: [
    {
      offeringId: "offering-1",
      cycle: "C3",
      businessLine: "licenciatura" as const,
      modality: "presencial" as const,
      programId: "program-1",
      programName: "Administración",
      campusId: "campus-1",
      campusKey: "HERMOSILLO",
      campusName: "Hermosillo",
      campusTier: "T1",
      pricingPlans: [9],
      module: "M1",
      campusAliases: ["campus-1", "HMO", "Hermosillo"],
      programAliases: [
        "program-1",
        "Administración",
        "Licenciatura en Administración",
      ],
    },
  ],
  unresolvedIssues: [],
};

const matchingOverride = {
  id: "price-1",
  scope: "base_price",
  targetKeys: {
    nivel_key: "licenciatura",
    modalidad_key: "presencial",
    plan: "9",
    plantel: "HMO",
    programa_key: "Licenciatura en Administracion",
    modulo: "M1",
    tier: "T1",
  },
  newPrice: 3900,
  isActive: true,
  notes: null,
  updatedBy: null,
};

describe("price import integrity guard", () => {
  it("permite replace cubierto sólo por configuración publicada", () => {
    const coverage = assertProjectedPriceImportCoverage({
      coverageInputs,
      publishedOverrides: [matchingOverride],
      currentLiveOverrides: [],
      rows: [],
      mode: "replace",
    });

    expect(coverage.coveredCombinations).toBe(1);
    expect(coverage.issues).toEqual([]);
  });

  it("permite update-only cubierto por override vivo", () => {
    const coverage = assertProjectedPriceImportCoverage({
      coverageInputs,
      publishedOverrides: [],
      currentLiveOverrides: [matchingOverride],
      rows: [
        {
          rowNumber: 2,
          action: "noop",
          existingId: "price-1",
          ...matchingOverride,
        },
      ],
      mode: "update-only",
    });

    expect(coverage.coveredCombinations).toBe(1);
    expect(coverage.issues).toEqual([]);
  });

  it("bloquea replace que elimina el único precio vivo", () => {
    expect(() =>
      assertProjectedPriceImportCoverage({
        coverageInputs,
        publishedOverrides: [],
        currentLiveOverrides: [matchingOverride],
        rows: [],
        mode: "replace",
      }),
    ).toThrowError(
      expect.objectContaining({
        name: "PriceImportCoverageError",
        code: "PRICE_IMPORT_COVERAGE_INCOMPLETE",
        details: expect.objectContaining({
          issues: [
            expect.objectContaining({
              offeringId: "offering-1",
              kind: "missing_base_price",
            }),
          ],
        }),
      }),
    );
  });

  it("permite problemas de cobertura preexistentes que el importador no introduce", () => {
    const unresolved = {
      ...coverageInputs,
      contexts: [],
      unresolvedIssues: [
        {
          kind: "unresolvable_offering_context" as const,
          offeringId: "offering-2",
          cycle: "C3",
          campus: "Online",
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
    };

    const coverage = assertProjectedPriceImportCoverage({
      coverageInputs: unresolved,
      publishedOverrides: [],
      currentLiveOverrides: [],
      rows: [],
      mode: "replace",
    });

    expect(coverage.issues).toHaveLength(1);
  });
});
