import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  campus: {
    findMany: vi.fn(),
  },
  adminPriceOverride: {
    findMany: vi.fn(),
  },
  adminAdditionalBenefit: {
    findMany: vi.fn(),
  },
  scholarshipRule: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  buildCsvTemplate,
  getAdminImportTemplate,
} from "@/lib/importers/admin-import-templates";
import { prepareBaseScholarshipsCsvImport } from "@/lib/importers/base-scholarships-csv";
import { prepareBenefitsCsvImport } from "@/lib/importers/benefits-csv";
import { preparePricesCsvImport } from "@/lib/importers/prices-csv";

function fileFromTemplate(id: string) {
  const template = getAdminImportTemplate(id);
  if (!template) throw new Error(`Missing template ${id}`);
  return new File([buildCsvTemplate(template)], template.fileName, { type: "text/csv" });
}

describe("admin import templates", () => {
  beforeEach(() => {
    prismaMock.campus.findMany.mockReset();
    prismaMock.adminPriceOverride.findMany.mockReset();
    prismaMock.adminAdditionalBenefit.findMany.mockReset();
    prismaMock.scholarshipRule.findMany.mockReset();

    prismaMock.campus.findMany.mockResolvedValue([
      {
        id: "campus-hermosillo",
        code: "HMO",
        metaKey: "Hermosillo",
        name: "Hermosillo",
        slug: "hermosillo",
      },
      {
        id: "campus-cdmx",
        code: "CDMX",
        metaKey: "CDMX",
        name: "CDMX",
        slug: "cdmx",
      },
    ]);
    prismaMock.adminPriceOverride.findMany.mockResolvedValue([]);
    prismaMock.adminAdditionalBenefit.findMany.mockResolvedValue([]);
    prismaMock.scholarshipRule.findMany.mockResolvedValue([]);
  });

  it("keeps the prices template aligned with the prices importer", async () => {
    const result = await preparePricesCsvImport({ file: fileFromTemplate("prices") });

    expect(result.summary.errors).toEqual([]);
    expect(result.summary.ready).toBe(2);
  });

  it("keeps the benefits template aligned with the benefits importer", async () => {
    const result = await prepareBenefitsCsvImport({ file: fileFromTemplate("benefits") });

    expect(result.summary.errors).toEqual([]);
    expect(result.summary.ready).toBe(2);
  });

  it("keeps the base scholarships template aligned with the base scholarships importer", async () => {
    const result = await prepareBaseScholarshipsCsvImport({
      file: fileFromTemplate("base-scholarships"),
    });

    expect(result.summary.errors).toEqual([]);
    expect(result.summary.ready).toBe(2);
  });
});
