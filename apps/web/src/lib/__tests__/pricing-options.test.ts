import { describe, expect, it } from "vitest";

import { buildQuotePricingOptions } from "@/lib/pricing-options";

describe("buildQuotePricingOptions", () => {
  it("adds canonical base-price override combinations for every enrollment type", () => {
    expect(
      buildQuotePricingOptions([], [
        {
          targetKeys: {
            nivel_key: "licenciatura",
            modalidad_key: "online",
            plan: "11",
            plantel: "ONLINE",
          },
        },
      ]).filter(
        (option) =>
          option.businessLine === "licenciatura" &&
          option.modality === "online" &&
          option.plan === 11,
      ),
    ).toEqual([
      {
        enrollmentType: "nuevo_ingreso",
        businessLine: "licenciatura",
        modality: "online",
        plan: 11,
      },
      {
        enrollmentType: "regreso",
        businessLine: "licenciatura",
        modality: "online",
        plan: 11,
      },
      {
        enrollmentType: "reingreso",
        businessLine: "licenciatura",
        modality: "online",
        plan: 11,
      },
    ]);
  });

  it("deduplicates combinations shared by scholarship rules and price overrides", () => {
    expect(
      buildQuotePricingOptions(
        [{ businessLine: "licenciatura", modality: "online", plan: 11 }],
        [
          {
            targetKeys: {
              nivel_key: "licenciatura",
              modalidad_key: "online",
              plan: "11",
            },
          },
        ],
      ).filter(
        (option) =>
          option.businessLine === "licenciatura" &&
          option.modality === "online" &&
          option.plan === 11,
      ),
    ).toHaveLength(3);
  });
  
  it("normalizes imported price rule aliases before exposing quote options", () => {
    const options = buildQuotePricingOptions([
      { businessLine: "preparatoria", modality: "presencial", plan: 6 },
      { businessLine: "maestria", modality: "online", plan: 4 },
      { businessLine: "Licenciatura", modality: "Ejecutiva", plan: 11 },
    ]);

    expect(options).toEqual(
      expect.arrayContaining([
        {
          enrollmentType: "nuevo_ingreso",
          businessLine: "prepa",
          modality: "presencial",
          plan: 6,
        },
        {
          enrollmentType: "nuevo_ingreso",
          businessLine: "posgrado",
          modality: "online",
          plan: 4,
        },
        {
          enrollmentType: "nuevo_ingreso",
          businessLine: "licenciatura",
          modality: "mixta",
          plan: 11,
        },
      ]),
    );
  });

  it("exposes Posgrado pricing options from both posgrado and maestria price aliases", () => {
    const options = buildQuotePricingOptions([], [
      {
        targetKeys: {
          nivel_key: "posgrado",
          modalidad_key: "online",
          plan: "4",
        },
      },
      {
        targetKeys: {
          nivel_key: "maestria",
          modalidad_key: "online",
          plan: "4",
        },
      },
    ]);

    expect(
      options.filter(
        (option) =>
          option.businessLine === "posgrado" &&
          option.modality === "online" &&
          option.plan === 4,
      ),
    ).toHaveLength(3);
  });

});
