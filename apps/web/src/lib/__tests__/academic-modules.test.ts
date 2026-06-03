import { describe, expect, it } from "vitest";

import {
  academicModuleMatches,
  formatAcademicModuleLabel,
  normalizeAcademicModule,
  normalizeAcademicModuleDisplay,
  parseAcademicModuleTokens,
} from "@/lib/academic-modules";

describe("academic module normalization", () => {
  it("keeps modular multi-module tracks as Modular instead of collapsing to M3", () => {
    expect(normalizeAcademicModule("Modular M1, M2")).toBe("Modular");
    expect(normalizeAcademicModule("Modular M1, M2, M3")).toBe("Modular");
    expect(normalizeAcademicModuleDisplay("Modular M1, M2, M3")).toBe("Modular M1, M2, M3");
    expect(parseAcademicModuleTokens("Modular M1, M2, M3")).toEqual(["M1", "M2", "M3"]);
  });

  it("matches modular distributions with their requested module parts", () => {
    expect(academicModuleMatches("Modular M1, M2", "M1")).toBe(true);
    expect(academicModuleMatches("Modular M1, M2", "M3")).toBe(false);
    expect(academicModuleMatches("Modular M1, M2, M3", "M3")).toBe(true);
  });

  it("keeps longitudinal and single module compatibility", () => {
    expect(normalizeAcademicModule("Longitudinal")).toBe("Longitudinal");
    expect(normalizeAcademicModule("M2")).toBe("M2");
    expect(academicModuleMatches("Longitudinal", "Longitudinal")).toBe(true);
  });

  it("formats module labels for authenticated UI without the M prefix", () => {
    expect(formatAcademicModuleLabel("M1")).toBe("1");
    expect(formatAcademicModuleLabel("M2")).toBe("2");
    expect(formatAcademicModuleLabel("M3")).toBe("3");
    expect(formatAcademicModuleLabel("Longitudinal")).toBe("Longitudinal");
  });
});
