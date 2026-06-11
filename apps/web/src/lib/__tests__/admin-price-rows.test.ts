import { describe, expect, it } from "vitest";

import { buildAdminPriceRows } from "@/lib/admin-price-rows";

describe("buildAdminPriceRows", () => {
  it("only exposes persisted canonical price overrides so every row is removable from UI", () => {
    const rows = buildAdminPriceRows({
      montoOverrides: [
        {
          id: "override-1",
          targetKeys: {
            nivel_key: "licenciatura",
            modalidad_key: "presencial",
            plan: "9",
            modulo: "Longitudinal",
          },
          newPrice: 4200,
          isActive: true,
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "price:override-1",
      source: "canonical",
      sourceOverrideId: "override-1",
      basePriceMxn: 4200,
    });
  });
});
