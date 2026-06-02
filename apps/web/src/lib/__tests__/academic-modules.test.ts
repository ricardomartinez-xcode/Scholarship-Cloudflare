import { describe, expect, it } from "vitest";

import {
  academicModuleMatches,
  academicModuleOrDefault,
  normalizeAcademicModule,
} from "@/lib/academic-modules";

describe("academic modules", () => {
  it("normalizes supported module labels", () => {
    expect(normalizeAcademicModule("M1")).toBe("M1");
    expect(normalizeAcademicModule("Módulo 2")).toBe("M2");
    expect(normalizeAcademicModule("Modulo III")).toBe("M3");
    expect(normalizeAcademicModule("longitudinal")).toBe("Longitudinal");
  });

  it("defaults empty modules to Longitudinal", () => {
    expect(academicModuleOrDefault("")).toBe("Longitudinal");
    expect(academicModuleOrDefault("otro")).toBe("Longitudinal");
  });

  it("treats empty stored modules as generic matches", () => {
    expect(academicModuleMatches(null, "M2")).toBe(true);
    expect(academicModuleMatches("M2", "M2")).toBe(true);
    expect(academicModuleMatches("M2", "M3")).toBe(false);
  });
});
