import { describe, expect, it } from "vitest";

import { findStaticBasePrice } from "@/lib/static-costs";

describe("findStaticBasePrice", () => {
  it("normalizes business line aliases to canonical values", () => {
    expect(
      findStaticBasePrice({
        businessLine: "bachillerato",
        modality: "presencial",
        plan: 6,
      }),
    ).toBe(3200);
    expect(
      findStaticBasePrice({
        businessLine: "lic",
        modality: "mixta",
        plan: 9,
      }),
    ).toBe(5400);
  });

  it("falls back to nearest configured plan", () => {
    expect(
      findStaticBasePrice({
        businessLine: "maestría",
        modality: "online",
        plan: 10,
      }),
    ).toBe(7700);
  });

  it("returns null for unknown combinations", () => {
    expect(
      findStaticBasePrice({
        businessLine: "desconocida",
        modality: "online",
        plan: 9,
      }),
    ).toBeNull();
  });
});
