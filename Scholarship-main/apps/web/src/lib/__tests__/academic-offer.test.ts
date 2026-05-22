import { describe, expect, it } from "vitest";

import {
  DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES,
  normalizeAcademicOfferCycle,
} from "@/config/academicOffer";

describe("academic offer cycle helpers", () => {
  it("normalizes valid cycles and rejects anything else", () => {
    expect(normalizeAcademicOfferCycle("c1")).toBe("C1");
    expect(normalizeAcademicOfferCycle(" C2 ")).toBe("C2");
    expect(normalizeAcademicOfferCycle("c3")).toBe("C3");
    expect(normalizeAcademicOfferCycle("C4")).toBeNull();
    expect(normalizeAcademicOfferCycle("C1 2026")).toBeNull();
  });

  it("keeps a safe default visible cycle set", () => {
    expect(DEFAULT_ACADEMIC_OFFER_VISIBLE_CYCLES).toEqual(["C1"]);
  });
});
