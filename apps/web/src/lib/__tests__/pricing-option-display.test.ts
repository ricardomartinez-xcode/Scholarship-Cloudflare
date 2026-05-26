import { describe, expect, it } from "vitest";

import { visibleQuoteCampuses, visibleQuoteModalities } from "@/lib/pricing-option-display";

describe("visibleQuoteModalities", () => {
  it("shows configured modalidades for licenciatura", () => {
    expect(visibleQuoteModalities(["online"], "licenciatura")).toEqual([
      "presencial",
      "mixta",
      "online",
    ]);
  });

  it("shows configured modalidades for prepa aliases", () => {
    expect(visibleQuoteModalities(["online"], "bachillerato")).toEqual([
      "presencial",
      "online",
    ]);
  });

  it("shows configured modalidades for salud and posgrado", () => {
    expect(visibleQuoteModalities(["online", "mixta", "presencial"], "salud")).toEqual([
      "presencial",
    ]);
    expect(visibleQuoteModalities(["presencial", "online"], "maestria")).toEqual(["online"]);
  });

  it("keeps normalized available modalities when line is unknown", () => {
    expect(visibleQuoteModalities(["online", "ejecutiva", "escolarizado"])).toEqual([
      "presencial",
      "mixta",
      "online",
    ]);
  });
});

describe("visibleQuoteCampuses", () => {
  it("treats Online as the campus for online modality", () => {
    expect(visibleQuoteCampuses([{ value: "TJN", label: "Tijuana" }], "online")).toEqual([
      { value: "ONLINE", label: "Online" },
    ]);
  });

  it("normalizes lowercase online campus value", () => {
    expect(
      visibleQuoteCampuses(
        [
          {
            value: "online",
            label: "Online",
            pricingOptions: [{ businessLine: "prepa", modality: "online", plan: 6 }],
          },
        ],
        "online",
        "bachillerato",
        6,
      ),
    ).toEqual([
      {
        value: "ONLINE",
        label: "Online",
        pricingOptions: [{ businessLine: "prepa", modality: "online", plan: 6 }],
      },
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
        "bachillerato",
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
