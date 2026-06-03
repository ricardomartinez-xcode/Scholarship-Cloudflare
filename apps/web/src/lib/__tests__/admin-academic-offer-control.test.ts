import { describe, expect, it } from "vitest";

import { resolveAcademicOfferJsonImport } from "@/lib/admin-academic-offer-control";

describe("admin academic offer control", () => {
  it("builds a dry-run import from normalized rows and infers the cycle", async () => {
    const result = await resolveAcademicOfferJsonImport({
      dryRun: true,
      rows: [
        {
          Ciclo: "C3",
          Plantel: "Online",
          Programa: "Derecho",
          Linea: "licenciatura",
          Modalidad: "online",
          Plan: "9",
          Modulo: "Longitudinal",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cycle).toBe("C3");
    expect(result.dryRun).toBe(true);
    expect(result.fileName).toBe("academic-offer-json.csv");
    expect(result.rowErrors).toEqual([]);
  });

  it("rejects normalized rows when no valid cycle can be resolved", async () => {
    const result = await resolveAcademicOfferJsonImport({
      rows: [
        { Ciclo: "C1", Plantel: "Online", Programa: "Derecho", Plan: "9" },
        { Ciclo: "C2", Plantel: "Online", Programa: "Psicologia", Plan: "9" },
      ],
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      errorCode: "INVALID_CYCLE",
      error: "Envía un ciclo único válido: C1, C2 o C3.",
      rowErrors: [],
    });
  });
});
