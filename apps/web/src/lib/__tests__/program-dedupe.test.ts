import { describe, expect, it } from "vitest";

import { buildAcademicProgramDedupePlan } from "@/lib/program-dedupe";

describe("program dedupe planning", () => {
  it("marks canonical aliases with fewer relations for destructive deletion", () => {
    const plan = buildAcademicProgramDedupePlan([
      {
        id: "with-offers",
        name: "Licenciatura en Psicología",
        nameNormalized: "licenciatura en psicologia",
        level: "LICENCIATURA",
        category: null,
        businessLine: "licenciatura",
        planPdfUrl: null,
        planDriveLink: null,
        planUrl: null,
        brochurePdfUrl: null,
        _count: { offerings: 3, quoteScenarios: 1, assetChecks: 0 },
      },
      {
        id: "extra-row",
        name: "Psicologia",
        nameNormalized: "psicologia",
        level: "LICENCIATURA",
        category: null,
        businessLine: "licenciatura",
        planPdfUrl: null,
        planDriveLink: null,
        planUrl: null,
        brochurePdfUrl: null,
        _count: { offerings: 0, quoteScenarios: 0, assetChecks: 0 },
      },
      {
        id: "derecho",
        name: "Licenciatura en Derecho",
        nameNormalized: "licenciatura en derecho",
        level: "LICENCIATURA",
        category: null,
        businessLine: "licenciatura",
        planPdfUrl: null,
        planDriveLink: null,
        planUrl: null,
        brochurePdfUrl: null,
        _count: { offerings: 1, quoteScenarios: 0, assetChecks: 0 },
      },
    ]);

    expect(plan.groups).toEqual([
      expect.objectContaining({
        canonicalKey: "licenciatura en psicologia",
        canonicalId: "with-offers",
        duplicateIds: ["extra-row"],
      }),
    ]);
    expect(plan.programsToDelete).toBe(1);
  });
});
