import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  listContentBucketObjectsMock,
  listFileAssetsMock,
  prismaMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  listContentBucketObjectsMock: vi.fn(),
  listFileAssetsMock: vi.fn(),
  prismaMock: {
    scholarshipRule: { findMany: vi.fn() },
    adminPriceOverride: { findMany: vi.fn() },
    campus: { findMany: vi.fn() },
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

vi.mock("@/lib/file-assets", () => ({
  fileAssetToContentBucketObject: vi.fn((file) => ({
    key: file.r2Key,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    lastModified: file.updatedAt?.toISOString?.() ?? null,
    previewUrl: `/api/files/${file.id}/auth-view`,
    downloadUrl: `/api/files/${file.id}/download`,
  })),
  listFileAssetAssignmentsForTargets: vi.fn().mockResolvedValue(new Map()),
  listFileAssets: listFileAssetsMock,
  resolveProgramR2AssetPayload: vi.fn((input) => ({
    planPdfUrl: input.assets?.study_plan_pdf?.previewUrl ?? input.planPdfUrl,
    brochurePdfUrl: input.assets?.brochure_pdf?.previewUrl ?? input.brochurePdfUrl,
    heroImageUrl: input.assets?.hero_image?.previewUrl ?? null,
    planDownloadUrl: input.assets?.study_plan_pdf?.downloadUrl ?? input.planPdfUrl,
    brochureDownloadUrl: input.assets?.brochure_pdf?.downloadUrl ?? input.brochurePdfUrl,
    r2Assets: {
      studyPlan: input.assets?.study_plan_pdf ?? null,
      brochure: input.assets?.brochure_pdf ?? null,
      heroImage: input.assets?.hero_image ?? null,
    },
  })),
}));

vi.mock("@/lib/r2-content-bucket", () => ({
  listContentBucketObjects: listContentBucketObjectsMock,
  findContentBucketPlanForProgram: vi.fn((programName: string, files: Array<{
    key: string;
    fileName: string;
    mimeType: string;
  }>) =>
    files.find((file) => {
      const source = `${file.key} ${file.fileName}`.toLowerCase();
      return file.mimeType === "application/pdf" && programName
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => token.length > 3)
        .some((token) => source.includes(token.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
    }) ?? null,
  ),
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
    listContentBucketObjectsMock.mockResolvedValue([]);
    listFileAssetsMock.mockResolvedValue([]);
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

  it("annotates campuses from active academic offerings and keeps offered programs independent from price", async () => {
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
            planDownloadUrl: "https://example.com/prepa.pdf",
          },
        ],
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
            planDownloadUrl: "https://example.com/lic.pdf",
          },
        ],
        pricingOptions: [
          {
            businessLine: "licenciatura",
            modality: "presencial",
            plan: 9,
            module: "Longitudinal",
            programId: "program_lic",
          },
        ],
      },
      {
        value: "monterrey",
        label: "Monterrey",
        businessLines: ["prepa"],
        modalities: ["presencial"],
        studyPrograms: [
          {
            id: "program_prepa",
            name: "Bachillerato UNIDEP",
            businessLine: "prepa",
            planPdfUrl: "https://example.com/prepa.pdf",
            planDownloadUrl: "https://example.com/prepa.pdf",
          },
        ],
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
            planDownloadUrl: "https://example.com/posgrado.pdf",
          },
        ],
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
    ]);
    expect(data.studyPrograms).toEqual([
      {
        id: "program_lic",
        name: "Administracion",
        businessLine: "licenciatura",
        planPdfUrl: "https://example.com/lic.pdf",
        planDownloadUrl: "https://example.com/lic.pdf",
      },
      {
        id: "program_posgrado",
        name: "Maestría en Educación",
        businessLine: "posgrado",
        planPdfUrl: "https://example.com/posgrado.pdf",
        planDownloadUrl: "https://example.com/posgrado.pdf",
      },
      {
        id: "program_prepa",
        name: "Bachillerato UNIDEP",
        businessLine: "prepa",
        planPdfUrl: "https://example.com/prepa.pdf",
        planDownloadUrl: "https://example.com/prepa.pdf",
      },
      {
        id: "program_catalog_salud",
        name: "Licenciatura en Enfermería",
        businessLine: "salud",
        planPdfUrl: "https://example.com/salud.pdf",
        planDownloadUrl: "https://example.com/salud.pdf",
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

  it("exposes configured offering plans even before a canonical price exists", async () => {
    prismaMock.scholarshipRule.findMany.mockResolvedValue([]);
    prismaMock.adminPriceOverride.findMany.mockResolvedValue([]);
    prismaMock.program.findMany.mockResolvedValue([
      {
        id: "program_psicologia",
        name: "Licenciatura en Psicología",
        nameNormalized: "licenciatura-en-psicologia",
        category: "Salud",
        level: "Licenciatura",
        businessLine: "salud",
        planPdfUrl: "https://example.com/psicologia.pdf",
        brochurePdfUrl: null,
        planDriveLink: null,
        planUrl: null,
      },
    ]);
    prismaMock.campus.findMany.mockResolvedValue([
      {
        id: "campus_hermosillo",
        code: "HMO",
        metaKey: "Hermosillo",
        name: "Hermosillo",
        tier: "T3",
      },
    ]);
    prismaMock.programOffering.findMany.mockResolvedValue([
      {
        id: "offering_psicologia_hmo",
        campusId: "campus_hermosillo",
        pricingPlans: [9],
        delivery: "CAMPUS",
        escolarizado: true,
        ejecutivo: false,
        lineOfBusiness: "Salud",
        program: {
          id: "program_psicologia",
          name: "Licenciatura en Psicología",
          businessLine: "salud",
          level: "Licenciatura",
          category: "Salud",
          planPdfUrl: "https://example.com/psicologia.pdf",
          planDriveLink: null,
          planUrl: null,
        },
      },
    ]);

    const response = await GET();
    const data = (await response.json()) as {
      campuses: Array<{
        value: string;
        businessLines: string[];
        modalities: string[];
        studyPrograms: Array<{ id: string; businessLine: string }>;
        pricingOptions: Array<{
          businessLine: string;
          modality: string;
          plan: number;
          programId: string;
        }>;
      }>;
    };

    expect(response.status).toBe(200);
    expect(data.campuses).toEqual([
      expect.objectContaining({
        value: "Hermosillo",
        businessLines: ["salud"],
        modalities: ["presencial"],
        studyPrograms: [
          expect.objectContaining({
            id: "program_psicologia",
            businessLine: "salud",
          }),
        ],
        pricingOptions: [
          {
            businessLine: "salud",
            modality: "presencial",
            plan: 9,
            module: "Longitudinal",
            programId: "program_psicologia",
            programKey: "program_psicologia",
          },
        ],
      }),
    ]);
  });

  it("prefers a synced R2 file asset over a legacy Drive URL when no explicit usage is assigned", async () => {
    listFileAssetsMock.mockResolvedValue([
      {
        id: "file_posgrado_plan",
        r2Key: "Maestría/Maestria en Educacion.pdf",
        fileName: "Maestria en Educacion.pdf",
        mimeType: "application/pdf",
        sizeBytes: 123,
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    ]);

    const response = await GET();
    const data = (await response.json()) as {
      studyPrograms: Array<{ id: string; planPdfUrl: string; planDownloadUrl: string | null }>;
    };

    const program = data.studyPrograms.find((item) => item.id === "program_posgrado");

    expect(response.status).toBe(200);
    expect(program?.planPdfUrl).toBe("/api/files/file_posgrado_plan/auth-view");
    expect(program?.planDownloadUrl).toBe("/api/files/file_posgrado_plan/download");
  });

});
