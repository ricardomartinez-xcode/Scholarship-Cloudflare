import { describe, expect, it } from "vitest";

import { visibleQuoteCampuses, visibleQuoteModalities } from "@/lib/pricing-option-display";

describe("visibleQuoteModalities", () => {
  it("keeps the allowed modalities for licenciatura", () => {
    expect(visibleQuoteModalities(["online", "mixta", "presencial"],
      "presencial",
      "mixta",
      "online",                                  
    ]);
  });

  it("keeps only presencial and online for bachillerato", () => {
    expect(visibleQuoteModalities(["online", "mixta", "presencial"], "prepa")).toEqual([
      "presencial",
      "online",
    ]);
  });

  it("keeps only presencial for salud", () => {
    expect(visibleQuoteModalities(["online", "mixta", "presencial"], "salud")).toEqual([
      "presencial",
    ]);
  });

  it("keeps only online for posgrado", () => {
    expect(visibleQuoteModalities(["online", "mixta", "presencial"], "posgrado")).toEqual([
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

  it("filters campus options by active academic offer business line", () => {
    expect(
      visibleQuoteCampuses(
        [
          {
            value: "CHH",
            label: "Chihuahua",
            businessLines: ["prepa", "licenciatura"],
            modalities: ["presencial"],
          },
          {
            value: "TJN",
            label: "Tijuana",
            businessLines: ["licenciatura"],
            modalities: ["presencial"],
          },
        ],
        "presencial",
        "prepa",
      ),
    ).toEqual([
      {
        value: "CHH",
        label: "Chihuahua",
        businessLines: ["prepa", "licenciatura"],
        modalities: ["presencial"],
      },
    ]);
  });

  it("filters campus options by base-price availability for the selected plan", () => {
    expect(
      visibleQuoteCampuses(
        [
          {
            value: "CHH",
            label: "Chihuahua",
            businessLines: ["prepa"],
            modalities: ["presencial"],
            pricingOptions: [{ businessLine: "prepa", modality: "presencial", plan: 6 }],
          },
          {
            value: "TJN",
            label: "Tijuana",
            businessLines: ["prepa"],
            modalities: ["presencial"],
            pricingOptions: [{ businessLine: "prepa", modality: "presencial", plan: 9 }],
          },
        ],
        "presencial",
        "prepa",
        6,
      ),
    ).toEqual([
      {
        value: "CHH",
        label: "Chihuahua",
        businessLines: ["prepa"],
        modalities: ["presencial"],
        pricingOptions: [{ businessLine: "prepa", modality: "presencial", plan: 6 }],
      },
    ]);
  });

  it("filters campus options by selected study plan program", () => {
    expect(
      visibleQuoteCampuses(
        [
          {
            value: "CHH",
            label: "Chihuahua",
            businessLines: ["prepa"],
            modalities: ["presencial"],
            pricingOptions: [
              {
                businessLine: "prepa",
                modality: "presencial",
                plan: 6,
                programId: "program_prepa",
              },
            ],
          },
          {
            value: "TJN",
            label: "Tijuana",
            businessLines: ["prepa"],
            modalities: ["presencial"],
            pricingOptions: [
              {
                businessLine: "prepa",
                modality: "presencial",
                plan: 6,
                programId: "other_program",
              },
            ],
          },
        ],
        "presencial",
        "prepa",
        6,
        "program_prepa",
      ),
    ).toEqual([
      {
        value: "CHH",
        label: "Chihuahua",
        businessLines: ["prepa"],
        modalities: ["presencial"],
        pricingOptions: [
          {
            businessLine: "prepa",
            modality: "presencial",
            plan: 6,
            programId: "program_prepa",
          },
        ],
      },
    ]);
  });
});
