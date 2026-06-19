import {
  AcademicFeeSection,
  AdminAdditionalBenefitType,
  BenefitDuration,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { ADMIN_IMPORT_TEMPLATES } from "@/lib/importers/admin-import-templates";
import {
  isAllScopeValue,
  normalizeAcademicFeeSectionForImport,
  normalizeBenefitDurationForImport,
  normalizeBenefitTypeForImport,
  normalizeBusinessLineForImport,
  normalizeEnrollmentTypeForImport,
  normalizeModalityForImport,
  normalizeProgramKeyForImport,
  parseImportBoolean,
  parseImportDelimitedText,
  parseImportInteger,
  parseImportMoney,
} from "@/lib/importers/global-import-normalization";

describe("global import normalization", () => {
  it("normalizes shared boolean, money and integer values", () => {
    expect(parseImportBoolean("Activo", false)).toBe(true);
    expect(parseImportBoolean("Inactivo", true)).toBe(false);
    expect(parseImportBoolean("", true)).toBe(true);
    expect(parseImportMoney("$1,250.50")).toBe(1250.5);
    expect(parseImportMoney("1.250,50")).toBe(1250.5);
    expect(parseImportMoney("bad")).toBeNull();
    expect(parseImportInteger("12.9")).toBe(12);
  });

  it("normalizes shared catalog values used by imports and manual UI", () => {
    expect(isAllScopeValue("Cualquier ingreso")).toBe(true);
    expect(normalizeBusinessLineForImport("Bachillerato")).toBe("prepa");
    expect(normalizeModalityForImport("Ejecutiva")).toBe("mixta");
    expect(normalizeEnrollmentTypeForImport("Nuevo ingreso")).toBe("nuevo_ingreso");
    expect(normalizeBenefitTypeForImport("Primer pago")).toBe(
      AdminAdditionalBenefitType.first_payment,
    );
    expect(normalizeBenefitDurationForImport("Toda la carrera")).toBe(
      BenefitDuration.toda_la_carrera,
    );
    expect(normalizeAcademicFeeSectionForImport("Trámites")).toBe(
      AcademicFeeSection.TRAMITES,
    );
    expect(normalizeProgramKeyForImport("Lic. en Derecho")).toBe("lic_en_derecho");
    expect(normalizeProgramKeyForImport("Todos")).toBeNull();
  });

  it("parses csv, semicolon and pipe files through one delimiter-aware parser", () => {
    expect(parseImportDelimitedText("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseImportDelimitedText("a|b\n1|2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseImportDelimitedText('a,b\n"1,000",2')).toEqual([
      ["a", "b"],
      ["1,000", "2"],
    ]);
  });
});

describe("global import templates", () => {
  it("publishes downloadable templates for all global data-entry domains", () => {
    const ids = ADMIN_IMPORT_TEMPLATES.map((template) => template.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "prices",
        "benefits",
        "base-scholarships",
        "academic-offer",
        "academic-fees",
      ]),
    );

    const fees = ADMIN_IMPORT_TEMPLATES.find((template) => template.id === "academic-fees");
    const prices = ADMIN_IMPORT_TEMPLATES.find((template) => template.id === "prices");
    const baseScholarships = ADMIN_IMPORT_TEMPLATES.find(
      (template) => template.id === "base-scholarships",
    );
    expect(prices?.headers).toContain("alcance");
    expect(baseScholarships?.headers).toEqual(
      expect.arrayContaining(["plan", "promedio_min", "promedio_max", "porcentaje_beca"]),
    );
    expect(fees?.headers).toEqual([
      "codigo",
      "concepto",
      "seccion",
      "costo_base",
      "plantel",
      "costo_plantel",
      "activo_plantel",
      "notas",
    ]);
  });
});
