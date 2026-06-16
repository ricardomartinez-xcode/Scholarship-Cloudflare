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

import { getAdminImportTemplate } from "@/lib/importers/admin-import-templates";
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
      {
        id: "campus-2",
        code: "HMO",
        metaKey: "Hermosillo",
        name: "Hermosillo",
        slug: "hermosillo",
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
      "linea,region,plantel,tier,benefit_type,applies_to_all,enrollment_type,modality,extra_percent",
      "licenciatura,Norte,Chihuahua,T2,percentage,false,nuevo_ingreso,presencial,15",
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
      "linea,region,plantel,tier,benefit_type,applies_to_all,enrollment_type,modality,extra_percent,notes",
      "licenciatura,Norte,Chihuahua,T2,percentage,true,nuevo_ingreso,presencial,15,Global activo",
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

  it("accepts the UI-shaped additional benefits CSV with human labels", async () => {
    const csv = [
      "linea_negocio,planteles,tipo_beneficio,tipo_ingreso,modalidad,duracion,porcentaje_adicional,estado,notas",
      "Licenciatura,Chihuahua; Hermosillo,Porcentaje adicional,Cualquier ingreso,Presencial,Toda la carrera,20,Activo,Origen Excel",
      "Todas,Todos,Porcentaje adicional,Nuevo ingreso,Todas,Cualquiera,100,Inactivo,Global NI",
    ].join("\n");

    const result = await prepareBenefitsCsvImport({
      file: new File([csv], "beneficios.csv", { type: "text/csv" }),
    });

    expect(result.summary.ready).toBe(2);
    expect(result.summary.errors).toEqual([]);
    expect(result.payload.rows[0]).toMatchObject({
      action: "create",
      benefitType: "percentage",
      enrollmentType: null,
      businessLine: "licenciatura",
      modality: "presencial",
      duration: "toda_la_carrera",
      appliesToAll: false,
      campusIds: ["campus-1", "campus-2"],
      campusLabels: ["Chihuahua", "Hermosillo"],
      extraPercent: 20,
      isActive: true,
      notes: "Origen Excel",
    });
    expect(result.payload.rows[1]).toMatchObject({
      action: "create",
      benefitType: "percentage",
      enrollmentType: "nuevo_ingreso",
      businessLine: null,
      modality: null,
      duration: null,
      appliesToAll: true,
      campusIds: [],
      campusLabels: [],
      extraPercent: 100,
      isActive: false,
      notes: "Global NI",
    });
  });

  it("exposes the downloadable benefits template with importer UI columns", () => {
    const template = getAdminImportTemplate("benefits");

    expect(template?.headers).toEqual([
      "linea_negocio",
      "planteles",
      "tipo_beneficio",
      "tipo_ingreso",
      "modalidad",
      "duracion",
      "porcentaje_adicional",
      "estado",
      "notas",
    ]);
    expect(template?.rows[0]).toHaveLength(9);
  });
});
