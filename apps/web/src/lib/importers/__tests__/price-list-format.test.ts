import { describe, expect, it } from "vitest";

import {
  normalizePriceListWorkbookRows,
  priceListRowsToCsv,
} from "@/lib/importers/price-list-format";

describe("price list workbook format", () => {
  it("normalizes OPP C3 price-list sheets into base price rows", () => {
    const rows = normalizePriceListWorkbookRows({
      sheets: [
        {
          name: "Bachillerato",
          rows: [
            [
              "Region",
              "Plantel",
              "TIER",
              "Precio Lista 6 Cuatrimestres (2 anos)",
              "Precio Lista 9 Cuatrimestres (3 anos)",
            ],
            ["Region 1", "Chihuahua", "TIER 2", "", 1890],
            ["Region 1", "Tijuana", "TIER 3", 3087, ""],
          ],
        },
      ],
    });

    expect(rows).toEqual([
      {
        plantel: "Chihuahua",
        nivelKey: "preparatoria",
        modalidadKey: "presencial",
        plan: "9",
        tier: "T2",
        newPrice: 1890,
        isActive: true,
        notes: "Bachillerato",
      },
      {
        plantel: "Chihuahua",
        nivelKey: "preparatoria",
        modalidadKey: "mixta",
        plan: "9",
        tier: "T2",
        newPrice: 1890,
        isActive: true,
        notes: "Bachillerato",
      },
      {
        plantel: "Tijuana",
        nivelKey: "preparatoria",
        modalidadKey: "presencial",
        plan: "6",
        tier: "T3",
        newPrice: 3087,
        isActive: true,
        notes: "Bachillerato",
      },
      {
        plantel: "Tijuana",
        nivelKey: "preparatoria",
        modalidadKey: "mixta",
        plan: "6",
        tier: "T3",
        newPrice: 3087,
        isActive: true,
        notes: "Bachillerato",
      },
    ]);
  });

  it("accepts direct flexible tables and emits the canonical CSV headers", () => {
    const rows = normalizePriceListWorkbookRows({
      sheets: [
        {
          name: "Carga flexible",
          rows: [
            ["Nivel", "Modalidad", "Plan", "Plantel", "Tier", "Precio Lista"],
            ["Licenciatura", "Ejecutiva", 11, "Chihuahua", "TIER 2", "$4,700.00"],
          ],
        },
      ],
    });

    expect(priceListRowsToCsv(rows)).toContain(
      "plantel,nivel_key,modalidad_key,plan,tier,new_price,is_active,notes",
    );
    expect(rows[0]).toMatchObject({
      plantel: "Chihuahua",
      nivelKey: "licenciatura",
      modalidadKey: "mixta",
      plan: "11",
      tier: "T2",
      newPrice: 4700,
    });
  });
});
