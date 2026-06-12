import { describe, expect, it } from "vitest";

import {
  buildAcademicProgramDedupePlan,
  buildAcademicProgramNameNormalizationPlan,
} from "@/lib/program-dedupe";

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

describe("program name normalization planning", () => {
  it("plans non-destructive renames to canonical academic program labels", () => {
    const plan = buildAcademicProgramNameNormalizationPlan([
      {
        id: "admin",
        name: "Administracion de Empresas",
        nameNormalized: "administracion de empresas",
        level: "Licenciatura",
        category: "Licenciatura",
        businessLine: "licenciatura",
      },
      {
        id: "masters",
        name: "Logistica y Cadena de Suministro",
        nameNormalized: "logistica y cadena de suministro",
        level: "Posgrado",
        category: "Posgrado",
        businessLine: "posgrado",
      },
      {
        id: "prepa",
        name: "Bachillerato General - Formacion en Administracion (2 Años)",
        nameNormalized: "bachillerato general formacion en administracion 2 anos",
        level: "Bachillerato",
        category: "Bachillerato",
        businessLine: "prepa",
      },
    ]);

    expect(plan.conflicts).toEqual([]);
    expect(plan.programsToUpdate).toBe(3);
    expect(plan.renames).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "admin",
        nextName: "Licenciatura en Administración de Empresas",
        nextNameNormalized: "licenciatura en administracion de empresas",
      }),
      expect.objectContaining({
        id: "prepa",
        nextName: "Bachillerato General - Formación en Administración (2 años)",
      }),
      expect.objectContaining({
        id: "masters",
        nextName: "Maestría en Logística y Cadena de Suministro",
      }),
    ]));
  });

  it("does not plan unsafe renames when two rows normalize to the same canonical key", () => {
    const plan = buildAcademicProgramNameNormalizationPlan([
      {
        id: "old",
        name: "Administracion de Empresas",
        nameNormalized: "administracion de empresas",
        level: "Licenciatura",
        category: null,
        businessLine: "licenciatura",
      },
      {
        id: "new",
        name: "Licenciatura en Administración de Empresas",
        nameNormalized: "licenciatura en administracion de empresas",
        level: "Licenciatura",
        category: null,
        businessLine: "licenciatura",
      },
    ]);

    expect(plan.renames).toEqual([]);
    expect(plan.conflicts).toEqual([
      expect.objectContaining({
        nextNameNormalized: "licenciatura en administracion de empresas",
        programIds: ["old", "new"],
      }),
    ]);
  });
});
