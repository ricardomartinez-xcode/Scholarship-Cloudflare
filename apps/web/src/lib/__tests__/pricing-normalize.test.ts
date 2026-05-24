import { describe, expect, it } from "vitest";

import { basePriceFromRules } from "@/lib/pricing-normalize";

describe("basePriceFromRules", () => {
  const baseRule = {
    enrollmentType: "nuevo_ingreso",
    businessLine: "posgrado",
    modality: "online",
    plan: 11,
    campusTier: "ANY",
    minAverage: null,
    maxAverage: null,
  };

  it("keeps list price stable when average ranges carry different discounted prices", () => {
    const rules = [
      {
        ...baseRule,
        minAverage: 7,
        maxAverage: 7.9,
        scholarshipPercent: 20,
        discountedPriceMxn: 4000,
      },
      {
        ...baseRule,
        minAverage: 8,
        maxAverage: 8.9,
        scholarshipPercent: 30,
        discountedPriceMxn: 4200,
      },
      {
        ...baseRule,
        minAverage: 9,
        maxAverage: 10,
        scholarshipPercent: 40,
        discountedPriceMxn: 3600,
      },
    ];

    expect(basePriceFromRules(rules)).toBe(6000);
  });

  it("ignores invalid rules and derives the highest stable list price", () => {
    const rules = [
      {
        ...baseRule,
        scholarshipPercent: 100,
        discountedPriceMxn: 0,
      },
      {
        ...baseRule,
        scholarshipPercent: 50,
        discountedPriceMxn: 1500,
      },
      {
        ...baseRule,
        scholarshipPercent: 25,
        discountedPriceMxn: 2400,
      },
    ];

    expect(basePriceFromRules(rules)).toBe(3200);
  });
});
