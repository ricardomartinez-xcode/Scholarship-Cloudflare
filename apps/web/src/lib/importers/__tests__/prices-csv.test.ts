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
      "plantel,nivel_key,modalidad_key,plan,tier,new_price,is_active,notes",
      "Chihuahua,preparatoria,presencial,9,T2,1890,true,Bachillerato",
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
      nivelKey: "preparatoria",
      modalidadKey: "presencial",
      plan: "9",
      tier: "T2",
      newPrice: 1890,
    });
  });
});
