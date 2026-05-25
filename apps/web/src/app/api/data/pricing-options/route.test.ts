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
        program: {
          id: "program_prepa",
          name: "Bachillerato UNIDEP",
          businessLine: "prepa",
          level: "Bachillerato",
          category: "Bachillerato",
          planPdfUrl: "https://example.com/prepa.pdf",
          planDriveLink: null,
          planUrl: null,
        },
      },
      {
        campusId: "campus_lic",
        delivery: "CAMPUS",
        escolarizado: true,
        ejecutivo: false,
        lineOfBusiness: "Licenciatura",
        program: {
          id: "program_lic",
          name: "Administracion",
          businessLine: "licenciatura",
          level: "Licenciatura",
          category: "Licenciatura",
          planPdfUrl: "https://example.com/lic.pdf",
          planDriveLink: null,
          planUrl: null,
        },
      },
      {
        campusId: "campus_without_price",
        delivery: "CAMPUS",
        escolarizado: true,
        ejecutivo: false,
        lineOfBusiness: "Bachillerato",
        program: {
          id: "program_prepa",
          name: "Bachillerato UNIDEP",
          businessLine: "prepa",
          level: "Bachillerato",
          category: "Bachillerato",
          planPdfUrl: "https://example.com/prepa.pdf",
          planDriveLink: null,
          planUrl: null,
        },
      },
      {
        campusId: "campus_lic",
        delivery: "CAMPUS",
        escolarizado: true,
        ejecutivo: false,
        lineOfBusiness: "Salud",
        program: {
          id: "program_salud_without_pdf",
          name: "Enfermeria",
          businessLine: "salud",
          level: "Licenciatura",
          category: "Salud",
          planPdfUrl: null,
          planDriveLink: null,
          planUrl: null,
        },
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
        studyPrograms: Array<{ id: string; name: string; businessLine: string }>;
        pricingOptions: Array<{
          businessLine: string;
          modality: string;
          plan: number;
          programId: string;
        }>;
      }>;
      studyPrograms: Array<{ id: string; name: string; businessLine: string }>;
    };

    expect(response.status).toBe(200);
    expect(data.campuses).toEqual([
      {
        value: "chihuahua",
        label: "Chihuahua",
        businessLines: ["prepa"],
        modalities: ["presencial"],
        studyPrograms: [
          {
            id: "program_prepa",
            name: "Bachillerato UNIDEP",
            businessLine: "prepa",
            planPdfUrl: "https://example.com/prepa.pdf",
          },
        ],
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
        value: "tijuana",
        label: "Tijuana",
        businessLines: ["licenciatura"],
        modalities: ["presencial"],
        studyPrograms: [
          {
            id: "program_lic",
            name: "Administracion",
            businessLine: "licenciatura",
            planPdfUrl: "https://example.com/lic.pdf",
          },
        ],
        pricingOptions: [
          {
            businessLine: "licenciatura",
            modality: "presencial",
            plan: 9,
            programId: "program_lic",
          },
        ],
      },
    ]);
    expect(data.studyPrograms).toEqual([
      {
        id: "program_lic",
        name: "Administracion",
        businessLine: "licenciatura",
        planPdfUrl: "https://example.com/lic.pdf",
      },
      {
        id: "program_prepa",
        name: "Bachillerato UNIDEP",
        businessLine: "prepa",
        planPdfUrl: "https://example.com/prepa.pdf",
      },
    ]);
  });
});
