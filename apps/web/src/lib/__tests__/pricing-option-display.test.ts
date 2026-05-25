import { describe, expect, it } from "vitest";

import { visibleQuoteCampuses, visibleQuoteModalities } from "@/lib/pricing-option-display";

describe("visibleQuoteModalities", () => {
  it("hides online for non-licenciatura lines when campus modalities exist", () => {
    expect(visibleQuoteModalities(["online", "mixta", "presencial"], "salud")).toEqual([
      "presencial",
      "mixta",
    ]);
  });

  it("keeps online visible for licenciatura even when campus modalities exist", () => {
    expect(visibleQuoteModalities(["online", "mixta", "presencial"], "licenciatura")).toEqual([
      "presencial",
      "mixta",
      "online",
    ]);
  });

  it("keeps online for online-only combinations", () => {
    expect(visibleQuoteModalities(["online"])).toEqual(["online"]);
  });

  it("treats Online as the campus for online modality", () => {
    expect(visibleQuoteCampuses([{ value: "TJN", label: "Tijuana" }], "online")).toEqual([
      { value: "ONLINE", label: "Online" },
    ]);
  });

  it("does not expose Online as a campus for non-online modalities", () => {
    expect(
      visibleQuoteCampuses(
        [
          { value: "ONLINE", label: "Online" },
          { value: "TJN", label: "Tijuana" },
        ],
        "presencial",
      ),
    ).toEqual([{ value: "TJN", label: "Tijuana" }]);
  });
});
