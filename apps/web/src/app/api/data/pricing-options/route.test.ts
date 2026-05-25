import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock, prismaMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  prismaMock: {
    scholarshipRule: { findMany: vi.fn() },
    adminPriceOverride: { findMany: vi.fn() },
    campus: { findMany: vi.fn() },
    returnSubjectPrice: { findMany: vi.fn() },
    programOffering: { findMany: vi.fn() },
    program: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/authz", () => ({
  getSessionUser: getSessionUserMock,
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
      {
        enrollmentType: "nuevo_ingreso",
        businessLine: "posgrado",
        modality: "online",
        plan: 11,
        campusTier: "ANY",
        minAverage: 8,
        maxAverage: 10,
        scholarshipPercent: 20,
        discountedPriceMxn: 6000,
      },
    ]);
    prismaMock.adminPriceOverride.findMany.mockResolvedValue([]);
    prismaMock.returnSubjectPrice.findMany.mockResolvedValue([]);
    prismaMock.program.findMany.mockResolvedValue([
      {
        id: "program_catalog_salud",
        name: "Licenciatura en Enfermería",
        nameNormalized: "licenciatura-en-enfermeria",
        category: "Salud",
        level: "Licenciatura",
        businessLine: "salud",
        planPdfUrl: "https://example.com/salud.pdf",
        brochurePdfUrl: null,
        planDriveLink: null,
        planUrl: null,
      },
      {
        id: "program_lic",
        name: "Administracion",
        nameNormalized: "administracion",
        category: "Licenciatura",
        level: "Licenciatura",
        businessLine: "licenciatura",
        planPdfUrl: "https://example.com/lic.pdf",
        brochurePdfUrl: null,
        planDriveLink: null,
        planUrl: null,
      },
      {
        id: "program_prepa",
        name: "Bachillerato UNIDEP",
        nameNormalized: "bachillerato-unidep",
        category: "Bachillerato",
        level: "Bachillerato",
        businessLine: "prepa",
        planPdfUrl: "https://example.com/prepa.pdf",
        brochurePdfUrl: null,
        planDriveLink: null,
        planUrl: null,
      },
      {
        id: "program_posgrado",
        name: "Maestría en Educación",
        nameNormalized: "maestria-en-educacion",
        category: "Posgrado",
        level: "Maestría",
        businessLine: "posgrado",
        planPdfUrl: "https://example.com/posgrado.pdf",
        brochurePdfUrl: null,
        planDriveLink: null,
        planUrl: null,
      },
    ]);
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
      {
        id: "campus_online",
        code: "ONLINE",
        metaKey: "online",
        name: "Online",
        tier: null,
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
        campusId: "campus_online",
        delivery: "ONLINE",
        escolarizado: false,
        ejecutivo: false,
        lineOfBusiness: "Maestria",
        program: {
          id: "program_posgrado",
          name: "Maestría en Educación",
          businessLine: null,
          level: "Maestría",
          category: "Posgrado",
          planPdfUrl: "https://example.com/posgrado.pdf",
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
      {
        value: "online",
        label: "Online",
        businessLines: ["posgrado"],
        modalities: ["online"],
        studyPrograms: [
          {
            id: "program_posgrado",
            name: "Maestría en Educación",
            businessLine: "posgrado",
            planPdfUrl: "https://example.com/posgrado.pdf",
          },
        ],
        pricingOptions: [
          {
            businessLine: "posgrado",
            modality: "online",
            plan: 11,
            programId: "program_posgrado",
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
        id: "program_posgrado",
        name: "Maestría en Educación",
        businessLine: "posgrado",
        planPdfUrl: "https://example.com/posgrado.pdf",
      },
      {
        id: "program_prepa",
        name: "Bachillerato UNIDEP",
        businessLine: "prepa",
        planPdfUrl: "https://example.com/prepa.pdf",
      },
      {
        id: "program_catalog_salud",
        name: "Licenciatura en Enfermería",
        businessLine: "salud",
        planPdfUrl: "https://example.com/salud.pdf",
      },
    ]);
    expect(prismaMock.programOffering.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          cycle: expect.anything(),
        }),
      }),
    );
  });
});
