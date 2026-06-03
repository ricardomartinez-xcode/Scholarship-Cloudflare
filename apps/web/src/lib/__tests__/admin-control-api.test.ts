import { describe, expect, it } from "vitest";

import {
  buildEnvPresence,
  inferAcademicOfferCycle,
  normalizeAcademicOfferRows,
  parseAdminPagination,
  validateAcademicOfferRows,
} from "@/lib/admin-control-api";

describe("admin-control-api helpers", () => {
  it("bounds admin pagination inputs", () => {
    const pagination = parseAdminPagination(
      new URLSearchParams({ page: "3", pageSize: "999" }),
      { defaultPageSize: 20, maxPageSize: 100 },
    );

    expect(pagination).toEqual({
      page: 3,
      pageSize: 100,
      skip: 200,
      take: 100,
    });
  });

  it("reports env presence without returning values", () => {
    const env = {
      DATABASE_URL: "postgres://secret",
      GITHUB_TOKEN: "",
    };

    expect(buildEnvPresence(["DATABASE_URL", "GITHUB_TOKEN"], env)).toEqual([
      { name: "DATABASE_URL", present: true },
      { name: "GITHUB_TOKEN", present: false },
    ]);
  });

  it("infers an academic offer cycle from normalized rows", () => {
    const rows = normalizeAcademicOfferRows([
      { Ciclo: "c2", Plantel: "Online", Programa: "Derecho", Plan: "9" },
      { cycle: "C2", campus: "Los Cabos", programa: "Psicologia", plan: "4" },
    ]);

    expect(inferAcademicOfferCycle(rows)).toBe("C2");
  });

  it("returns row errors for unsupported cycles, plans, and modules", () => {
    const rows = normalizeAcademicOfferRows([
      {
        Ciclo: "C4",
        Plantel: "",
        Programa: "Derecho",
        Modalidad: "presencial",
        Plan: "12",
        Modulo: "M4",
      },
    ]);

    expect(validateAcademicOfferRows(rows)).toEqual({
      ok: false,
      rowErrors: [
        expect.objectContaining({ row: 2, field: "ciclo", code: "INVALID_CYCLE" }),
        expect.objectContaining({ row: 2, field: "plantel", code: "REQUIRED_FIELD" }),
        expect.objectContaining({ row: 2, field: "plan", code: "INVALID_PLAN" }),
        expect.objectContaining({ row: 2, field: "modulo", code: "INVALID_MODULE" }),
      ],
    });
  });
});
