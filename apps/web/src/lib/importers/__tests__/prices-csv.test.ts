import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  adminPriceOverride: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { preparePricesCsvImport } from "@/lib/importers/prices-csv";

describe("preparePricesCsvImport", () => {
  beforeEach(() => {
    prismaMock.adminPriceOverride.findMany.mockReset();
  });

  it("prepares price-list imports as base_price overrides keyed by campus when present", async () => {
    prismaMock.adminPriceOverride.findMany.mockResolvedValue([
      {
        id: "override-1",
        targetKeys: {
          plantel: "Chihuahua",
          nivel_key: "preparatoria",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T2",
        },
        newPrice: 1800,
        isActive: true,
        notes: null,
      },
    ]);

    const csv = [
      "linea,region,plantel,tier,precio,modalidad_key,plan,is_active,notes",
      "preparatoria,Region 1,Chihuahua,T2,1890,presencial,9,true,Bachillerato",
    ].join("\n");
    const file = new File([csv], "precios.csv", { type: "text/csv" });

    const result = await preparePricesCsvImport({ file });

    expect(prismaMock.adminPriceOverride.findMany).toHaveBeenCalledWith({
      where: { scope: "base_price" },
      select: {
        id: true,
        targetKeys: true,
        newPrice: true,
        isActive: true,
        notes: true,
      },
    });
    expect(result.payload.rows[0]).toMatchObject({
      action: "update",
      existingId: "override-1",
      plantel: "Chihuahua",
      region: "Region 1",
      nivelKey: "preparatoria",
      modalidadKey: "presencial",
      plan: "9",
      tier: "T2",
      newPrice: 1890,
    });
  });

  it("does not key canonical price imports by legacy programa", async () => {
    prismaMock.adminPriceOverride.findMany.mockResolvedValue([
      {
        id: "override-1",
        targetKeys: {
          programa_key: "nuevo_ingreso",
          nivel_key: "licenciatura",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T1",
        },
        newPrice: 4289,
        isActive: true,
        notes: null,
      },
    ]);

    const csv = [
      "programa,nivel_key,modalidad_key,plan,tier,new_price",
      "reingreso,licenciatura,presencial,9,T1,4290",
    ].join("\n");
    const file = new File([csv], "precios.csv", { type: "text/csv" });

    const result = await preparePricesCsvImport({ file });

    expect(result.payload.rows[0]).toMatchObject({
      action: "update",
      existingId: "override-1",
      programaKey: "reingreso",
      nivelKey: "licenciatura",
      modalidadKey: "presencial",
      plan: "9",
      tier: "T1",
      newPrice: 4290,
    });
  });

  it("accepts the visible UI headers and normalizes canonical values", async () => {
    prismaMock.adminPriceOverride.findMany.mockResolvedValue([]);

    const csv = [
      "Línea de negocio,Region,Plantel,Tier,Precio lista,Modalidad,Plan",
      "Bachillerato,Región 1,Chihuahua,TIER 2,\"$1,890.00\",Escolarizada,9",
      "Posgrado,Online,Online,Online,4200,Ejecutiva,4",
    ].join("\n");
    const file = new File([csv], "precios-visibles.csv", { type: "text/csv" });

    const result = await preparePricesCsvImport({ file });

    expect(result.payload.rows).toHaveLength(2);
    expect(result.payload.rows[0]).toMatchObject({
      action: "create",
      region: "Región 1",
      plantel: "Chihuahua",
      nivelKey: "preparatoria",
      modalidadKey: "presencial",
      plan: "9",
      tier: "T2",
      newPrice: 1890,
    });
    expect(result.payload.rows[1]).toMatchObject({
      nivelKey: "maestria",
      modalidadKey: "mixta",
      plan: "4",
      tier: null,
      newPrice: 4200,
    });
  });

  it("keeps supporting internal CSV headers", async () => {
    prismaMock.adminPriceOverride.findMany.mockResolvedValue([]);

    const csv = [
      "linea,region,plantel,tier,precio,modalidad_key,plan",
      "licenciatura,Region 1,Chihuahua,T1,4700,presencial,11",
    ].join("\n");
    const file = new File([csv], "precios-internos.csv", { type: "text/csv" });

    const result = await preparePricesCsvImport({ file });

    expect(result.payload.rows[0]).toMatchObject({
      nivelKey: "licenciatura",
      modalidadKey: "presencial",
      plan: "11",
      tier: "T1",
      newPrice: 4700,
    });
  });

  it("reports missing columns with detected headers and a valid example", async () => {
    const csv = ["foo,bar", "a,b"].join("\n");
    const file = new File([csv], "precios-invalidos.csv", { type: "text/csv" });

    await expect(preparePricesCsvImport({ file })).rejects.toMatchObject({
      name: "PricesCsvValidationError",
      code: "MISSING_REQUIRED_COLUMNS",
      status: 422,
      message: expect.stringContaining("Encabezados detectados: foo, bar."),
    });
  });
});
