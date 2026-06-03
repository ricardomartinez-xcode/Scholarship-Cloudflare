import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  getPublishedConfigSnapshotMock,
  getAcademicOfferVisibleCyclesMock,
  listFileAssetAssignmentsForTargetsMock,
  listContentBucketObjectsMock,
  listFileAssetsMock,
  logPublicRouteTimingMock,
  prismaMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getPublishedConfigSnapshotMock: vi.fn(),
  getAcademicOfferVisibleCyclesMock: vi.fn(),
  listFileAssetAssignmentsForTargetsMock: vi.fn(),
  listContentBucketObjectsMock: vi.fn(),
  listFileAssetsMock: vi.fn(),
  logPublicRouteTimingMock: vi.fn(),
  prismaMock: {
    campus: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    programOffering: {
      findMany: vi.fn(),
    },
    program: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock("@/lib/authz", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/admin-config-snapshots", () => ({
  getPublishedConfigSnapshot: getPublishedConfigSnapshotMock,
}));

vi.mock("@/lib/academic-offer-config", () => ({
  getAcademicOfferVisibleCycles: getAcademicOfferVisibleCyclesMock,
}));

vi.mock("@/lib/public-route-cache", () => ({
  buildPublicRequestId: () => "request_1",
  logPublicRouteTiming: logPublicRouteTimingMock,
  normalizePublicCacheKeyPart: (value: string) => value || "_",
  PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS: 1,
  PUBLIC_ROUTE_CACHE_TAGS: { oferta: "public-oferta" },
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
  listFileAssetAssignmentsForTargets: listFileAssetAssignmentsForTargetsMock,
  listFileAssets: listFileAssetsMock,
  resolveProgramR2AssetPayload: vi.fn((input) => ({
    planPdfUrl: input.assets?.study_plan_pdf?.previewUrl ?? input.planPdfUrl,
    brochurePdfUrl: input.assets?.brochure_pdf?.previewUrl ?? input.brochurePdfUrl,
    heroImageUrl: input.assets?.hero_image?.previewUrl ?? null,
    thumbnailImageUrl: input.assets?.thumbnail_image?.previewUrl ?? null,
    planDownloadUrl: input.assets?.study_plan_pdf?.downloadUrl ?? input.planPdfUrl,
    brochureDownloadUrl: input.assets?.brochure_pdf?.downloadUrl ?? input.brochurePdfUrl,
    r2Assets: {
      studyPlan: input.assets?.study_plan_pdf ?? null,
      brochure: input.assets?.brochure_pdf ?? null,
      heroImage: input.assets?.hero_image ?? null,
      thumbnailImage: input.assets?.thumbnail_image ?? null,
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

describe("GET /api/public/oferta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      status: "ok",
      user: { id: "user_1" },
      email: "asesor@example.com",
    });
    getAcademicOfferVisibleCyclesMock.mockResolvedValue(["C1"]);
    listFileAssetAssignmentsForTargetsMock.mockResolvedValue(new Map());
    listContentBucketObjectsMock.mockResolvedValue([]);
    listFileAssetsMock.mockResolvedValue([]);
    getPublishedConfigSnapshotMock.mockResolvedValue({
      snapshot: {
        visibleCycles: ["C1"],
        campuses: [],
        programs: [
          {
            id: "program_1",
            name: "Administracion snapshot viejo",
            nameNormalized: "administracion",
            level: "Licenciatura",
            category: "Negocios",
            businessLine: "licenciatura",
            planPdfUrl: "https://example.com/old.pdf",
            brochurePdfUrl: null,
            planDriveLink: null,
            planUrl: null,
          },
        ],
        offerings: [
          {
            id: "offering_1",
            campusId: "campus_1",
            programId: "program_1",
            cycle: "C1",
            delivery: "CAMPUS",
            escolarizado: true,
            ejecutivo: false,
            escolarizadoSchedule: "Matutino",
            ejecutivoSchedule: null,
            lineOfBusiness: "Licenciatura",
            isActive: true,
          },
        ],
      },
    });
    prismaMock.programOffering.findMany.mockResolvedValue([
      {
        id: "offering_1",
        programId: "program_1",
        delivery: "CAMPUS",
        escolarizado: true,
        ejecutivo: false,
        escolarizadoSchedule: "Matutino",
        ejecutivoSchedule: null,
        lineOfBusiness: "Licenciatura",
        campus: {
          id: "campus_1",
          code: "CHH",
          metaKey: "chihuahua",
          name: "Chihuahua",
          slug: "chihuahua",
          tier: "T1",
          kind: "campus",
        },
      },
    ]);
    prismaMock.program.findMany.mockResolvedValue([
      {
        id: "program_1",
        name: "Administracion actualizada",
        nameNormalized: "administracion",
        category: "Negocios",
        level: "Licenciatura",
        businessLine: "licenciatura",
        brochurePdfUrl: "https://example.com/current-brochure.pdf",
        planPdfUrl: "https://example.com/current.pdf",
        planDriveLink: null,
        planUrl: null,
      },
    ]);
  });

  it("uses the current Prisma program catalog even when a published snapshot is stale", async () => {
    const response = await GET(new Request("http://localhost/api/public/oferta?cycle=C1"));
    const data = (await response.json()) as {
      programs: Array<{ name: string; planPdfUrl: string | null }>;
      offerings: Array<{ program: { name: string }; planLink: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(data.programs).toEqual([
      expect.objectContaining({
        name: "Administracion actualizada",
        planPdfUrl: "https://example.com/current.pdf",
      }),
    ]);
    expect(data.offerings).toEqual([
      expect.objectContaining({
        program: { id: "program_1", name: "Administracion actualizada" },
        planLink: "https://example.com/current.pdf",
      }),
    ]);
  });

  it("keeps legacy plan URLs when matching bucket PDFs are not explicitly linked", async () => {
    listContentBucketObjectsMock.mockResolvedValue([
      {
        key: "Licenciatura/Administracion actualizada.pdf",
        fileName: "Administracion actualizada.pdf",
        mimeType: "application/pdf",
        sizeBytes: 123,
        lastModified: null,
        previewUrl: "https://r2.example/Licenciatura/Administracion%20actualizada.pdf",
        downloadUrl: "https://r2.example/Licenciatura/Administracion%20actualizada.pdf?download=1",
      },
    ]);

    const response = await GET(new Request("http://localhost/api/public/oferta?cycle=C1"));
    const data = (await response.json()) as {
      programs: Array<{ name: string; planPdfUrl: string | null; planDownloadUrl: string | null }>;
      offerings: Array<{ program: { name: string }; planLink: string | null; planDownloadLink: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(data.programs[0]).toMatchObject({
      name: "Administracion actualizada",
      planPdfUrl: "https://example.com/current.pdf",
      planDownloadUrl: "https://example.com/current.pdf",
    });
    expect(data.offerings[0]).toMatchObject({
      planLink: "https://example.com/current.pdf",
      planDownloadLink: "https://example.com/current.pdf",
    });
  });

  it("uses explicitly linked R2 study plan assets before legacy program URLs", async () => {
    listFileAssetAssignmentsForTargetsMock.mockResolvedValue(
      new Map([
        [
          "program_1",
          {
            study_plan_pdf: {
              fileId: "file_program_1_plan",
              fileName: "Administracion actualizada.pdf",
              mimeType: "application/pdf",
              sizeBytes: 123,
              previewUrl: "/api/files/file_program_1_plan/auth-view",
              downloadUrl: "/api/files/file_program_1_plan/download",
            },
          },
        ],
      ]),
    );

    const response = await GET(new Request("http://localhost/api/public/oferta?cycle=C1"));
    const data = (await response.json()) as {
      programs: Array<{ name: string; planPdfUrl: string | null; planDownloadUrl: string | null }>;
      offerings: Array<{ planLink: string | null; planDownloadLink: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(data.programs[0]).toMatchObject({
      name: "Administracion actualizada",
      planPdfUrl: "/api/files/file_program_1_plan/auth-view",
      planDownloadUrl: "/api/files/file_program_1_plan/download",
    });
    expect(data.offerings[0]).toMatchObject({
      planLink: "/api/files/file_program_1_plan/auth-view",
      planDownloadLink: "/api/files/file_program_1_plan/download",
    });
  });
});
