import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, overridesMock, benefitsMock, campusMock, logMock } = vi.hoisted(() => ({
  prismaMock: {
    scholarshipRule: { findMany: vi.fn() },
    returnSubjectPrice: { findFirst: vi.fn() },
  },
  overridesMock: vi.fn(),
  benefitsMock: vi.fn(),
  campusMock: vi.fn(),
  logMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/published-price-overrides", () => ({
  listActivePublishedPriceOverrides: overridesMock,
}));
vi.mock("@/lib/additional-benefits", () => ({
  resolveAdditionalBenefits: benefitsMock,
}));
vi.mock("@/lib/campus-resolver", () => ({
  resolveCampus: campusMock,
  buildCampusAliases: (campus: { id?: string; name?: string; metaKey?: string; code?: string } | null, input?: string | null) =>
    [input, campus?.id, campus?.name, campus?.metaKey, campus?.code].filter(Boolean),
}));
vi.mock("@/lib/observability", () => ({
  logStructured: logMock,
}));

import { BASE_PRICE_OVERRIDE_SCOPE } from "@/lib/base-price-overrides";
import { resolveScholarshipQuote } from "@/lib/scholarship-quote-service";

function rule(params: {
  enrollmentType?: string;
  businessLine: string;
  modality: string;
  plan: number;
  campusTier: string | null;
  percent?: number;
  discounted: number;
}) {
  return {
    enrollmentType: params.enrollmentType ?? "nuevo_ingreso",
    businessLine: params.businessLine,
    modality: params.modality,
    plan: params.plan,
    campusTier: params.campusTier,
    minAverage: 8,
    maxAverage: 10,
    scholarshipPercent: params.percent ?? 20,
    discountedPriceMxn: params.discounted,
  };
}

describe("resolveScholarshipQuote canonical base price priority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    campusMock.mockResolvedValue({
      id: "campus_hermosillo",
      name: "Hermosillo",
      metaKey: "hermosillo",
      code: "CAMPUS_HERMOSILLO",
      tier: "T3",
    });
    overridesMock.mockResolvedValue([]);
    benefitsMock.mockResolvedValue({
      percentageBenefit: null,
      firstPaymentBenefit: null,
    });
    prismaMock.returnSubjectPrice.findFirst.mockResolvedValue(null);
  });

  it("uses exact campus canonical price before tier for Licenciatura Hermosillo Presencial Plan 9", async () => {
    prismaMock.scholarshipRule.findMany.mockResolvedValue([
      rule({ businessLine: "licenciatura", modality: "presencial", plan: 9, campusTier: "T3", discounted: 8000 }),
    ]);
    overridesMock.mockResolvedValue([
      {
        id: "override_plantel",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          nivel_key: "licenciatura",
          modalidad_key: "presencial",
          plan: 9,
          plantel: "Hermosillo",
        },
        newPrice: 12345,
        isActive: true,
      },
    ]);

    const result = await resolveScholarshipQuote({
      enrollmentType: "nuevo_ingreso",
      businessLine: "licenciatura",
      modality: "presencial",
      plan: 9,
      campus: "Hermosillo",
      average: 9,
      selectedProgramId: "program_lic",
      offeringId: "offering_lic",
    });

    expect(result.ok && result.basePriceMxn).toBe(12345);
    expect(result.ok && result.scholarshipAmountMxn).toBe(2469);
  });

  it("uses exact campus price when campus tier is null", async () => {
    campusMock.mockResolvedValue({
      id: "campus_null",
      name: "Campus Null",
      metaKey: "campus_null",
      code: "CAMPUS_NULL",
      tier: null,
    });
    prismaMock.scholarshipRule.findMany.mockResolvedValue([]);
    overridesMock.mockResolvedValue([
      {
        id: "override_plantel_null_tier",
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        targetKeys: {
          nivel_key: "licenciatura",
          modalidad_key: "presencial",
          plan: 9,
          plantel: "Campus Null",
        },
        newPrice: 4321,
        isActive: true,
      },
    ]);

    const result = await resolveScholarshipQuote({
      enrollmentType: "nuevo_ingreso",
      businessLine: "licenciatura",
      modality: "presencial",
      plan: 9,
      campus: "Campus Null",
      average: 9,
    });

    expect(result.ok && result.basePriceMxn).toBe(4321);
  });

  it("uses tier canonical price when no campus price exists", async () => {
    prismaMock.scholarshipRule.findMany.mockResolvedValue([
      rule({ businessLine: "licenciatura", modality: "presencial", plan: 9, campusTier: "T3", discounted: 8000 }),
      rule({ businessLine: "licenciatura", modality: "presencial", plan: 9, campusTier: "ANY", discounted: 4000 }),
    ]);

    const result = await resolveScholarshipQuote({
      enrollmentType: "nuevo_ingreso",
      businessLine: "licenciatura",
      modality: "presencial",
      plan: 9,
      campus: "Hermosillo",
      average: 9,
    });

    expect(result.ok && result.basePriceMxn).toBe(10000);
  });

  it("uses general canonical price when no campus or tier price exists", async () => {
    prismaMock.scholarshipRule.findMany.mockResolvedValue([
      rule({ businessLine: "prepa", modality: "presencial", plan: 6, campusTier: "ANY", discounted: 3200, percent: 20 }),
    ]);

    const result = await resolveScholarshipQuote({
      enrollmentType: "nuevo_ingreso",
      businessLine: "prepa",
      modality: "presencial",
      plan: 6,
      campus: "Hermosillo",
      average: 9,
    });

    expect(result.ok && result.basePriceMxn).toBe(4000);
  });

  it("uses static fallback last and logs warning with quote dimensions", async () => {
    prismaMock.scholarshipRule.findMany.mockResolvedValue([]);

    const result = await resolveScholarshipQuote({
      enrollmentType: "nuevo_ingreso",
      businessLine: "salud",
      modality: "presencial",
      plan: 9,
      campus: "Hermosillo",
      average: 9,
      selectedProgramId: "psicologia",
      offeringId: "offering_psicologia",
    });

    expect(result.ok && result.basePriceMxn).toBe(6400);
    expect(logMock).toHaveBeenCalledWith(
      "warn",
      "Quote used static base price fallback",
      expect.objectContaining({
        metadata: expect.objectContaining({
          businessLine: "salud",
          modality: "presencial",
          plan: 9,
          campus: "Hermosillo",
          tier: "T3",
          selectedProgramId: "psicologia",
          offeringId: "offering_psicologia",
          enrollmentType: "nuevo_ingreso",
          reason: "canonical_price_not_found",
        }),
      }),
    );
  });

  it("does not use Licenciatura price for Posgrado when Posgrado canonical price exists", async () => {
    prismaMock.scholarshipRule.findMany.mockResolvedValue([
      rule({ businessLine: "posgrado", modality: "online", plan: 4, campusTier: "ANY", discounted: 6000, percent: 25 }),
    ]);

    const result = await resolveScholarshipQuote({
      enrollmentType: "nuevo_ingreso",
      businessLine: "posgrado",
      modality: "online",
      plan: 4,
      campus: "ONLINE",
      average: 9,
    });

    expect(prismaMock.scholarshipRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollmentType: "nuevo_ingreso",
          businessLine: "posgrado",
          modality: "online",
          plan: 4,
        }),
      }),
    );
    expect(result.ok && result.basePriceMxn).toBe(8000);
  });

  it("keeps Salud and Bachillerato separated by business line and applies benefits after canonical price", async () => {
    prismaMock.scholarshipRule.findMany.mockResolvedValue([
      rule({ businessLine: "salud", modality: "presencial", plan: 12, campusTier: "T3", discounted: 9000, percent: 10 }),
    ]);
    benefitsMock.mockResolvedValue({
      percentageBenefit: { extraPercent: 5, notes: null, duration: null },
      firstPaymentBenefit: null,
    });

    const result = await resolveScholarshipQuote({
      enrollmentType: "nuevo_ingreso",
      businessLine: "salud",
      modality: "presencial",
      plan: 12,
      campus: "Hermosillo",
      average: 9,
      selectedProgramId: "enfermeria",
    });

    expect(prismaMock.scholarshipRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessLine: "salud",
          modality: "presencial",
          plan: 12,
        }),
      }),
    );
    expect(result.ok && result.basePriceMxn).toBe(10000);
    expect(result.ok && result.scholarshipAmountMxn).toBe(1000);
    expect(result.ok && result.additionalBenefitAmountMxn).toBe(500);
  });
});
