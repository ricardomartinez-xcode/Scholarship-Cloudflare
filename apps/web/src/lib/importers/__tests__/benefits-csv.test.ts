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

  it("preserves scoped display fields without adding them to the benefit identity", async () => {
    const csv = [
      "region,planteles,tier,benefit_type,applies_to_all,enrollment_type,business_line,modality,extra_percent",
      "Norte,Chihuahua,T2,percentage,false,nuevo_ingreso,licenciatura,presencial,15",
    ].join("\n");

    const result = await prepareBenefitsCsvImport({
      file: new File([csv], "beneficios.csv", { type: "text/csv" }),
    });

    expect(result.summary.ready).toBe(1);
    expect(result.summary.errors).toEqual([]);
    expect(result.payload.rows[0]).toMatchObject({
      region: "Norte",
      tier: "T2",
      campusIds: ["campus-1"],
      campusLabels: ["Chihuahua"],
      action: "create",
    });
    expect(result.payload.rows[0]?.key).not.toContain("Norte");
    expect(result.payload.rows[0]?.key).not.toContain("T2");
  });

  it("matches global benefit rows without plantel, region, or tier in the identity", async () => {
    prismaMock.adminAdditionalBenefit.findMany.mockResolvedValue([
      {
        id: "benefit-global",
        benefitType: "percentage",
        enrollmentType: "nuevo_ingreso",
        businessLine: "licenciatura",
        modality: "presencial",
        duration: null,
        appliesToAll: true,
        campuses: [],
        extraPercent: 10,
        firstPaymentAmount: 0,
        isActive: true,
        notes: null,
      },
    ]);
    const csv = [
      "region,planteles,tier,benefit_type,applies_to_all,enrollment_type,business_line,modality,extra_percent,notes",
      "Norte,Chihuahua,T2,percentage,true,nuevo_ingreso,licenciatura,presencial,15,Global activo",
    ].join("\n");

    const result = await prepareBenefitsCsvImport({
      file: new File([csv], "beneficios.csv", { type: "text/csv" }),
    });

    expect(result.summary.ready).toBe(1);
    expect(result.summary.errors).toEqual([]);
    expect(result.payload.rows[0]).toMatchObject({
      action: "update",
      existingId: "benefit-global",
      appliesToAll: true,
      campusIds: [],
      region: "Norte",
      tier: "T2",
    });
    expect(result.payload.rows[0]?.key).not.toContain("Norte");
    expect(result.payload.rows[0]?.key).not.toContain("T2");
    expect(result.payload.rows[0]?.key).not.toContain("campus-1");
  });
});
