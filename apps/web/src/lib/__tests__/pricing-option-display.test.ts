import { describe, expect, it } from "vitest";

import {
  visibleQuoteBusinessLines,
  visibleQuoteCampuses,
  visibleQuoteModalities,
  visibleQuotePaymentPlans,
  visibleQuoteStudyPrograms,
} from "@/lib/pricing-option-display";

describe("visibleQuoteModalities", () => {
  it("limits licenciatura modalidades to priced options", () => {
    expect(visibleQuoteModalities(["online"], "licenciatura")).toEqual([
      "online",
    ]);
  });

  it("limits prepa aliases to priced options", () => {
    expect(visibleQuoteModalities(["online"], "bachillerato")).toEqual([
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

  it("does not invent modalidades when no priced options are available", () => {
    expect(visibleQuoteModalities([], "licenciatura")).toEqual([]);
  });
});

describe("visibleQuoteBusinessLines", () => {
  it("uses active academic offer lines even when no quote price exists yet", () => {
    expect(
      visibleQuoteBusinessLines([
        {
          value: "HMO",
          label: "Hermosillo",
          businessLines: ["salud"],
          modalities: ["presencial"],
          studyPrograms: [{ id: "program_enfermeria", name: "Enfermería", businessLine: "salud" }],
          pricingOptions: [],
        },
      ]),
    ).toEqual(["salud"]);
  });
});

describe("visibleQuoteStudyPrograms", () => {
  it("uses active academic offer programs even when no quote price exists yet", () => {
    expect(
      visibleQuoteStudyPrograms(
        [
          {
            value: "HMO",
            label: "Hermosillo",
            businessLines: ["salud"],
            modalities: ["presencial"],
            studyPrograms: [{ id: "program_enfermeria", name: "Enfermería", businessLine: "salud" }],
            pricingOptions: [],
          },
        ],
        [],
        "salud",
        "presencial",
      ),
    ).toEqual([{ id: "program_enfermeria", name: "Enfermería", businessLine: "salud" }]);
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
            pricingOptions: [{ businessLine: "prepa", modality: "online", plan: 6, module: "Longitudinal" }],
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
        pricingOptions: [{ businessLine: "prepa", modality: "online", plan: 6, module: "Longitudinal" }],
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
            pricingOptions: [{ businessLine: "prepa", modality: "presencial", plan: 6, module: "Longitudinal" }],
          },
          {
            value: "TJN",
            label: "Tijuana",
            businessLines: ["licenciatura"],
            modalities: ["presencial"],
            pricingOptions: [{ businessLine: "licenciatura", modality: "presencial", plan: 6, module: "Longitudinal" }],
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
        pricingOptions: [{ businessLine: "prepa", modality: "presencial", plan: 6, module: "Longitudinal" }],
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
            pricingOptions: [{ businessLine: "prepa", modality: "presencial", plan: 6, module: "Longitudinal" }],
          },
          {
            value: "TJN",
            label: "Tijuana",
            businessLines: ["prepa"],
            modalities: ["presencial"],
            pricingOptions: [{ businessLine: "prepa", modality: "presencial", plan: 9, module: "Longitudinal" }],
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
        pricingOptions: [{ businessLine: "prepa", modality: "presencial", plan: 6, module: "Longitudinal" }],
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
                module: "Longitudinal",
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
                module: "Longitudinal",
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
            module: "Longitudinal",
            programId: "program_prepa",
          },
        ],
      },
    ]);
  });

  it("keeps offered campuses visible before selecting a payment plan", () => {
    expect(
      visibleQuoteCampuses(
        [
          {
            value: "CHH",
            label: "Chihuahua",
            businessLines: ["prepa"],
            modalities: ["presencial"],
            studyPrograms: [{ id: "program_prepa", name: "Bachillerato", businessLine: "prepa" }],
            pricingOptions: [],
          },
        ],
        "presencial",
        "prepa",
        null,
        "program_prepa",
      ),
    ).toEqual([
      {
        value: "CHH",
        label: "Chihuahua",
        businessLines: ["prepa"],
        modalities: ["presencial"],
        studyPrograms: [{ id: "program_prepa", name: "Bachillerato", businessLine: "prepa" }],
        pricingOptions: [],
      },
    ]);
  });
});

describe("visibleQuotePaymentPlans", () => {
  it("uses the normalized Online campus options when the selected plantel is ONLINE", () => {
    expect(
      visibleQuotePaymentPlans({
        campuses: [
          {
            value: "online",
            label: "Online",
            pricingOptions: [
              {
                businessLine: "posgrado",
                modality: "online",
                plan: 11,
                module: "Longitudinal",
                programId: "program_posgrado",
              },
            ],
          },
        ],
        fallbackOptions: [
          {
            businessLine: "posgrado",
            modality: "online",
            plan: 11,
            module: "Longitudinal",
          },
        ],
        businessLine: "posgrado",
        modality: "online",
        plantel: "ONLINE",
        studyProgramId: "program_posgrado",
      }),
    ).toEqual([11]);
  });
});
