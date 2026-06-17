import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildCampusAliasesMock,
  findStaticBasePriceMock,
  listActivePublishedPriceOverridesMock,
  prismaMock,
  resolveAdditionalBenefitsMock,
  resolveCampusMock,
} = vi.hoisted(() => ({
  buildCampusAliasesMock: vi.fn(),
  findStaticBasePriceMock: vi.fn(),
  listActivePublishedPriceOverridesMock: vi.fn(),
  prismaMock: {
    scholarshipRule: { findMany: vi.fn() },
  },
  resolveAdditionalBenefitsMock: vi.fn(),
  resolveCampusMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/published-price-overrides", () => ({
  listActivePublishedPriceOverrides: listActivePublishedPriceOverridesMock,
}));

vi.mock("@/lib/additional-benefits", () => ({
  resolveAdditionalBenefits: resolveAdditionalBenefitsMock,
}));

vi.mock("@/lib/campus-resolver", () => ({
  buildCampusAliases: buildCampusAliasesMock,
  resolveCampus: resolveCampusMock,
}));

vi.mock("@/lib/static-costs", () => ({
  findStaticBasePrice: findStaticBasePriceMock,
}));

import { resolveScholarshipQuote } from "@/lib/scholarship-quote-service";

describe("resolveScholarshipQuote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildCampusAliasesMock.mockReturnValue([]);
    findStaticBasePriceMock.mockReturnValue(null);
    listActivePublishedPriceOverridesMock.mockResolvedValue([]);
    resolveAdditionalBenefitsMock.mockResolvedValue({
      percentageBenefit: null,
      firstPaymentBenefit: null,
    });
    resolveCampusMock.mockResolvedValue(null);
  });

  it("matches program-scoped scholarship rules using imported aliases before generic rules", async () => {
    prismaMock.scholarshipRule.findMany.mockResolvedValue([
      {
        enrollmentType: "nuevo_ingreso",
        businessLine: "licenciatura",
        modality: "online",
        plan: 9,
        campusTier: "ANY",
        region: null,
        plantel: null,
        programaKey: null,
        minAverage: 8,
        maxAverage: 10,
        scholarshipPercent: 0,
        discountedPriceMxn: 3000,
      },
      {
        enrollmentType: "nuevo_ingreso",
        businessLine: "licenciatura",
        modality: "online",
        plan: 9,
        campusTier: "ANY",
        region: null,
        plantel: null,
        programaKey: "Industrial y Sistemas",
        minAverage: 8,
        maxAverage: 10,
        scholarshipPercent: 20,
        discountedPriceMxn: 4080,
      },
    ]);

    const result = await resolveScholarshipQuote({
      enrollmentType: "nuevo_ingreso",
      businessLine: "licenciatura",
      modality: "online",
      plan: 9,
      average: 9,
      selectedProgramName: "Licenciatura en Ingeniería Industrial y de Sistemas",
    });

    expect(result).toMatchObject({
      ok: true,
      basePriceMxn: 5100,
      scholarshipPercent: 20,
      totalMxn: 4080,
    });
  });
});
