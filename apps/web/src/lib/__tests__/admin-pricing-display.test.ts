import { describe, expect, it } from "vitest";

import {
  compareAdminPricingScope,
  formatAdminPricingTier,
  normalizeAdminPricingRegion,
} from "@/lib/admin-pricing-display";

describe("admin pricing display order", () => {
  it("orders scope as region, campus, tier, then value", () => {
    const rows = [
      { region: "Region 2", plantel: "Tijuana", tier: "T3", value: "2000" },
      { region: "Region 1", plantel: "Tijuana", tier: "T3", value: "2000" },
      { region: "Region 1", plantel: "Chihuahua", tier: "T2", value: "2500" },
      { region: "Region 1", plantel: "Chihuahua", tier: "T1", value: "3000" },
    ];

    expect([...rows].sort(compareAdminPricingScope)).toEqual([
      { region: "Region 1", plantel: "Chihuahua", tier: "T1", value: "3000" },
      { region: "Region 1", plantel: "Chihuahua", tier: "T2", value: "2500" },
      { region: "Region 1", plantel: "Tijuana", tier: "T3", value: "2000" },
      { region: "Region 2", plantel: "Tijuana", tier: "T3", value: "2000" },
    ]);
  });

  it("labels online as the tier exception", () => {
    expect(formatAdminPricingTier({ plantel: "ONLINE", modality: "online" })).toBe("Online");
    expect(formatAdminPricingTier({ tier: "ANY" })).toBe("General");
    expect(normalizeAdminPricingRegion(null)).toBe("General");
  });
});
