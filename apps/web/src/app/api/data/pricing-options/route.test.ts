import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock, getAcademicOfferVisibleCyclesMock, prismaMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getAcademicOfferVisibleCyclesMock: vi.fn(),
  prismaMock: {
    scholarshipRule: { findMany: vi.fn() },
    adminPriceOverride: { findMany: vi.fn() },
    campus: { findMany: vi.fn() },
    returnSubjectPrice: { findMany: vi.fn() },
    programOffering: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/authz", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/academic-offer-config", () => ({
  getAcademicOfferVisibleCycles: getAcademicOfferVisibleCyclesMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { GET } from "./route";

describe("GET /api/data/pricing-options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      status: "ok",
      user: { id: "user_1" },
    });
    getAcademicOfferVisibleCyclesMock.mockResolvedValue(["C1"]);
    prismaMock.scholarshipRule.findMany.mockResolvedValue([
      {
        enrollmentType: "nuevo_ingreso",
        businessLine: "prepa",
        modality: "presencial",
        plan: 6,
        campusTier: "T3",
        minAverage: 8,
        maxAverage: 10,
        scholarshipPercent: null,
        discountedPriceMxn: null,
      },
      {
        enrollmentType: "nuevo_ingreso",
        businessLine: "prepa",
        modality: "presencial",
        plan: 6,
        campusTier: "T1",
        minAverage: 8,
        maxAverage: 10,
        scholarshipPercent: 20,
        discountedPriceMxn: 4000,
      },
      {
        enrollmentType: "nuevo_ingreso",
        businessLine: "licenciatura",
        modality: "presencial",
        plan: 9,
        campusTier: "T2",
        minAverage: 8,
        maxAverage: 10,
        scholarshipPercent: 20,
        discountedPriceMxn: 5000,
      },
    ]);
    prismaMock.adminPriceOverride.findMany.mockResolvedValue([]);
    prismaMock.returnSubjectPrice.findMany.mockResolvedValue([]);
    prismaMock.campus.findMany.mockResolvedValue([
      {
        id: "campus_prepa",
        code: "CHH",
        metaKey: "chihuahua",
        name: "Chihuahua",
        tier: "T1",
      },
      {
        id: "campus_lic",
        code: "TJN",
        metaKey: "tijuana",
        name: "Tijuana",
        tier: "T2",
      },
      {
        id: "campus_empty",
        code: "SLW",
        metaKey: "saltillo",
        name: "Saltillo",
        tier: "T1",
      },
      {
        id: "campus_without_price",
        code: "MTY",
        metaKey: "monterrey",
        name: "Monterrey",
        tier: "T3",
      },
    ]);
    prismaMock.programOffering.findMany.mockResolvedValue([
      {
        campusId: "campus_prepa",
        delivery: "CAMPUS",
        escolarizado: true,
        ejecutivo: false,
        lineOfBusiness: "Bachillerato",
        program: { businessLine: "prepa" },
      },
      {
        campusId: "campus_lic",
        delivery: "CAMPUS",
        escolarizado: true,
        ejecutivo: false,
        lineOfBusiness: "Licenciatura",
        program: { businessLine: "licenciatura" },
      },
      {
        campusId: "campus_without_price",
        delivery: "CAMPUS",
        escolarizado: true,
        ejecutivo: false,
        lineOfBusiness: "Bachillerato",
        program: { businessLine: "prepa" },
      },
    ]);
  });

  it("annotates campuses from active academic offerings and omits campuses without current offer or base price", async () => {
    const response = await GET();
    const data = (await response.json()) as {
      campuses: Array<{
        value: string;
        label: string;
        businessLines: string[];
        modalities: string[];
      }>;
    };

    expect(response.status).toBe(200);
    expect(data.campuses).toEqual([
      {
        value: "chihuahua",
        label: "Chihuahua",
        businessLines: ["prepa"],
        modalities: ["presencial"],
        pricingOptions: [
          { businessLine: "prepa", modality: "presencial", plan: 6 },
        ],
      },
      {
        value: "tijuana",
        label: "Tijuana",
        businessLines: ["licenciatura"],
        modalities: ["presencial"],
        pricingOptions: [
          { businessLine: "licenciatura", modality: "presencial", plan: 9 },
        ],
      },
    ]);
  });
});
