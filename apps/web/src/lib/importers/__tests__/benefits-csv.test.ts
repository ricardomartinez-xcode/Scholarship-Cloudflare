import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  campus: {
    findMany: vi.fn(),
  },
  adminAdditionalBenefit: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { prepareBenefitsCsvImport } from "@/lib/importers/benefits-csv";

describe("prepareBenefitsCsvImport", () => {
  beforeEach(() => {
    prismaMock.campus.findMany.mockReset();
    prismaMock.adminAdditionalBenefit.findMany.mockReset();
    prismaMock.campus.findMany.mockResolvedValue([
      {
        id: "campus-1",
        code: "CUU",
        metaKey: "Chihuahua",
        name: "Chihuahua",
        slug: "chihuahua",
      },
    ]);
    prismaMock.adminAdditionalBenefit.findMany.mockResolvedValue([]);
  });

  it("rejects removed fixed scholarship benefit rows", async () => {
    const csv = [
      "benefit_type,applies_to_all,enrollment_type,business_line,modality,first_payment_amount",
      "fixed_scholarship,true,nuevo_ingreso,licenciatura,presencial,100",
    ].join("\n");

    const result = await prepareBenefitsCsvImport({
      file: new File([csv], "beneficios.csv", { type: "text/csv" }),
    });

    expect(result.summary.ready).toBe(0);
    expect(result.summary.errors).toContain(
      'Fila 2: benefit_type inválido "fixed_scholarship".',
    );
  });
});
