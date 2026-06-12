import { describe, expect, it } from "vitest";

import { dedupeUnidepProgramCatalog } from "@/lib/unidep-program-catalog";

describe("unidep program catalog", () => {
  it("collapses legacy duplicate academic program names to one canonical row", () => {
    const rows = [
      {
        id: "legacy-psicologia",
        name: "Licenciatura en Psicología",
        nameNormalized: "licenciatura en psicologia",
        category: null,
        level: "LICENCIATURA",
        businessLine: "licenciatura",
        planPdfUrl: null,
        brochurePdfUrl: null,
        planDriveLink: null,
        planUrl: null,
        _count: { offerings: 4 },
      },
      {
        id: "extra-psicologia",
        name: "Psicologia",
        nameNormalized: "psicologia",
        category: null,
        level: "LICENCIATURA",
        businessLine: "licenciatura",
        planPdfUrl: null,
        brochurePdfUrl: null,
        planDriveLink: null,
        planUrl: null,
        _count: { offerings: 0 },
      },
      {
        id: "derecho",
        name: "Lic. en Derecho",
        nameNormalized: "lic en derecho",
        category: null,
        level: "LICENCIATURA",
        businessLine: "licenciatura",
        planPdfUrl: null,
        brochurePdfUrl: null,
        planDriveLink: null,
        planUrl: null,
        _count: { offerings: 1 },
      },
    ] as const;

    const catalog = dedupeUnidepProgramCatalog(rows);

    expect(catalog).toHaveLength(2);
    expect(catalog.map((program) => program.name)).toEqual(["Lic. en Derecho", "Licenciatura en Psicología"]);
    expect(catalog.find((program) => program.name === "Licenciatura en Psicología")?.id).toBe("legacy-psicologia");
  });
});
