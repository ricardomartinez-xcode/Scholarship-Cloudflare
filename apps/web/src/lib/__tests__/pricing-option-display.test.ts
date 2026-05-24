import { describe, expect, it } from "vitest";

import { visibleQuoteModalities } from "@/lib/pricing-option-display";

describe("visibleQuoteModalities", () => {
  it("hides online when campus modalities exist for the same line", () => {
    expect(visibleQuoteModalities(["online", "mixta", "presencial"])).toEqual([
      "presencial",
      "mixta",
    ]);
  });

  it("keeps online for online-only combinations", () => {
    expect(visibleQuoteModalities(["online"])).toEqual(["online"]);
  });
});
