import { describe, expect, it } from "vitest";

import {
  BASE_PRICE_OVERRIDE_SCOPE,
  findPublishedBasePriceOverride,
} from "@/lib/base-price-overrides";
import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";

describe("findPublishedBasePriceOverride", () => {
  it("prefers campus-specific price-list overrides over tier-level overrides", () => {
    const overrides: PriceOverrideSnapshot[] = [
      {
        id: "tier-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          nivel_key: "preparatoria",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T2",
        },
        newPrice: 2058,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
      {
        id: "campus-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          plantel: "Chihuahua",
          nivel_key: "preparatoria",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T2",
        },
        newPrice: 1890,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
    ];

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "prepa",
        modality: "presencial",
        plan: 9,
        tier: "T2",
        campus: "Chihuahua",
      }),
    ).toBe(1890);
  });
});
