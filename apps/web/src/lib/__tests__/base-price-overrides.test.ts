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

  it("uses canonical price-list overrides without depending on historical enrollment keys", () => {
    const overrides: PriceOverrideSnapshot[] = [
      {
        id: "historical-program-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          programa_key: "reingreso",
          nivel_key: "licenciatura",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T1",
        },
        newPrice: 4290,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
    ];

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "licenciatura",
        modality: "presencial",
        plan: 9,
        tier: "T1",
      }),
    ).toBe(4290);
  });

  it("matches campus price overrides with accents, campus prefixes, and compact keys", () => {
    const overrides = [
      {
        id: "queretaro-price",
        scope: "base_price",
        targetKeys: {
          nivel_key: "licenciatura",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T2",
          plantel: "CAMPUS_QUERETARO",
        },
        newPrice: 4321,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
    ];

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "licenciatura",
        modality: "presencial",
        plan: 9,
        tier: "T2",
        campus: "Querétaro",
        campusAliases: ["queretaro", "campus_queretaro"],
      }),
    ).toBe(4321);
  });

  it("uses a campus-specific canonical price when the campus catalog has no tier", () => {
    const overrides: PriceOverrideSnapshot[] = [
      {
        id: "hermosillo-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          plantel: "Hermosillo",
          nivel_key: "licenciatura",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T3",
        },
        newPrice: 4970,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
    ];

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "licenciatura",
        modality: "presencial",
        plan: 9,
        tier: "ANY",
        campus: "Hermosillo",
        campusAliases: ["CAMPUS_HERMOSILLO"],
      }),
    ).toBe(4970);
  });

  it("prefers the exact campus tier when multiple campus-specific prices exist", () => {
    const overrides: PriceOverrideSnapshot[] = [
      {
        id: "fallback-campus-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          plantel: "Hermosillo",
          nivel_key: "licenciatura",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T2",
        },
        newPrice: 4900,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
      {
        id: "exact-campus-tier-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          plantel: "Hermosillo",
          nivel_key: "licenciatura",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T3",
        },
        newPrice: 4970,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
    ];

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "licenciatura",
        modality: "presencial",
        plan: 9,
        tier: "T3",
        campus: "Hermosillo",
      }),
    ).toBe(4970);
  });

  it("does not use a generic tier price when the runtime tier does not match", () => {
    const overrides: PriceOverrideSnapshot[] = [
      {
        id: "generic-tier-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          nivel_key: "licenciatura",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T3",
        },
        newPrice: 4970,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
    ];

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "licenciatura",
        modality: "presencial",
        plan: 9,
        tier: "ANY",
        campus: "Hermosillo",
      }),
    ).toBeNull();
  });

  it("matches Posgrado canonical price overrides whether the imported key is posgrado or maestria", () => {
    const overrides: PriceOverrideSnapshot[] = [
      {
        id: "posgrado-canonical-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          nivel_key: "posgrado",
          modalidad_key: "online",
          plan: "4",
          tier: "ANY",
          plantel: "ONLINE",
        },
        newPrice: 4847.04,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
      {
        id: "licenciatura-online-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          nivel_key: "licenciatura",
          modalidad_key: "online",
          plan: "4",
          tier: "ANY",
          plantel: "ONLINE",
        },
        newPrice: 7100,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
    ];

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "posgrado",
        modality: "online",
        plan: 4,
        tier: "ANY",
        campus: "ONLINE",
      }),
    ).toBe(4847.04);
  });

  it("keeps Posgrado, Prepa, Licenciatura and Salud separated while accepting their import aliases", () => {
    const overrides: PriceOverrideSnapshot[] = [
      {
        id: "maestria-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          nivel_key: "maestria",
          modalidad_key: "online",
          plan: "4",
          tier: "ANY",
        },
        newPrice: 4847.04,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
      {
        id: "preparatoria-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          nivel_key: "preparatoria",
          modalidad_key: "presencial",
          plan: "6",
          tier: "T2",
        },
        newPrice: 3087,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
      {
        id: "salud-plan-9-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          nivel_key: "salud",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T3",
        },
        newPrice: 4560,
        isActive: true,
        notes: "Psicología Salud Plan 9",
        updatedBy: null,
      },
    ];

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "posgrado",
        modality: "online",
        plan: 4,
        tier: "ANY",
      }),
    ).toBe(4847.04);

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "prepa",
        modality: "presencial",
        plan: 6,
        tier: "T2",
      }),
    ).toBe(3087);

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "salud",
        modality: "presencial",
        plan: 9,
        tier: "T3",
      }),
    ).toBe(4560);

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "licenciatura",
        modality: "online",
        plan: 4,
        tier: "ANY",
      }),
    ).toBeNull();
  });

  it("prefers program-specific Salud Plan 9 price only for Psicologia", () => {
    const overrides: PriceOverrideSnapshot[] = [
      {
        id: "salud-generic-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          nivel_key: "salud",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T3",
        },
        newPrice: 5600,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
      {
        id: "psicologia-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          programa_key: "psicologia",
          plantel: "Hermosillo",
          nivel_key: "salud",
          modalidad_key: "presencial",
          plan: "9",
          tier: "T3",
        },
        newPrice: 4970,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
    ];

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "salud",
        modality: "presencial",
        plan: 9,
        tier: "T3",
        campus: "Hermosillo",
        programName: "Licenciatura en Psicología",
      }),
    ).toBe(4970);

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "salud",
        modality: "presencial",
        plan: 9,
        tier: "T3",
        campus: "Hermosillo",
        programName: "Licenciatura en Nutrición",
      }),
    ).toBe(5600);
  });

  it("uses a general line/modality/plan price after plantel and tier scopes", () => {
    const overrides: PriceOverrideSnapshot[] = [
      {
        id: "general-posgrado-price",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          nivel_key: "posgrado",
          modalidad_key: "online",
          plan: "4",
        },
        newPrice: 4100,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
    ];

    expect(
      findPublishedBasePriceOverride(overrides, {
        businessLine: "posgrado",
        modality: "online",
        plan: 4,
        tier: "ANY",
        campus: "ONLINE",
      }),
    ).toBe(4100);
  });


});
