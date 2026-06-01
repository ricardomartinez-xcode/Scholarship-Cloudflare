import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  listContentBucketObjectsMock,
  listFileAssetsMock,
  logPublicRouteTimingMock,
  prismaMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  listContentBucketObjectsMock: vi.fn(),
  listFileAssetsMock: vi.fn(),
  logPublicRouteTimingMock: vi.fn(),
  prismaMock: {
    program: {
      findMany: vi.fn(),
    },
    programOffering: {
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

vi.mock("@/lib/public-route-cache", () => ({
  buildPublicRequestId: () => "request_1",
  logPublicRouteTiming: logPublicRouteTimingMock,
  normalizePublicCacheKeyPart: (value: string) => value || "_",
  PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS: 1,
  PUBLIC_ROUTE_CACHE_TAGS: { planes: "public-planes" },
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

describe("GET /api/public/planes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      status: "ok",
      user: { id: "user_1" },
      email: "asesor@example.com",
    });
    listContentBucketObjectsMock.mockResolvedValue([]);
    listFileAssetsMock.mockResolvedValue([]);
    prismaMock.program.findMany.mockResolvedValue([
      {
        id: "program_prepa",
        name: "Bachillerato UNIDEP actualizado",
        nameNormalized: "bachillerato-unidep",
        category: "Bachillerato",
        level: "Bachillerato",
        businessLine: "prepa",
        planPdfUrl: "https://example.com/prepa-current.pdf",
        brochurePdfUrl: null,
        planDriveLink: null,
        planUrl: null,
      },
      {
        id: "program_lic",
        name: "Administracion",
        nameNormalized: "administracion",
        category: "Negocios",
        level: "Licenciatura",
        businessLine: "licenciatura",
        planPdfUrl: "https://example.com/lic.pdf",
        brochurePdfUrl: null,
        planDriveLink: null,
        planUrl: null,
      },
    ]);
    prismaMock.programOffering.findMany.mockResolvedValue([
      {
        programId: "program_prepa",
      },
    ]);
  });

  it("uses the current Prisma catalog and normalizes Bachillerato/prepa line filters", async () => {
    const response = await GET(
      new Request("http://localhost/api/public/planes?line=Bachillerato"),
    );
    const data = (await response.json()) as {
      programs: Array<{ id: string; name: string; businessLine: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(data.programs).toEqual([
      expect.objectContaining({
        id: "program_prepa",
        name: "Bachillerato UNIDEP actualizado",
        businessLine: "prepa",
      }),
    ]);
  });

  it("filters study plans by active campus offerings when campus and cycle are provided", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/public/planes?line=prepa&campus=chihuahua&cycle=C1&modality=presencial",
      ),
    );
    const data = (await response.json()) as {
      programs: Array<{ id: string; name: string; businessLine: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(prismaMock.programOffering.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          cycle: "C1",
          campus: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              { metaKey: "chihuahua" },
              { code: "chihuahua" },
              { name: "chihuahua" },
            ]),
          }),
        }),
      }),
    );
    expect(data.programs.map((program) => program.id)).toEqual(["program_prepa"]);
  });

  it("prefers a matching R2 content bucket PDF over the legacy program URL", async () => {
    listContentBucketObjectsMock.mockResolvedValue([
      {
        key: "Bachillerato/Bachillerato UNIDEP actualizado.pdf",
        fileName: "Bachillerato UNIDEP actualizado.pdf",
        mimeType: "application/pdf",
        sizeBytes: 123,
        lastModified: null,
        previewUrl: "https://r2.example/Bachillerato/Bachillerato%20UNIDEP%20actualizado.pdf",
        downloadUrl:
          "https://r2.example/Bachillerato/Bachillerato%20UNIDEP%20actualizado.pdf?download=1",
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/public/planes?line=Bachillerato"),
    );
    const data = (await response.json()) as {
      programs: Array<{ id: string; planPdfUrl: string | null; planDownloadUrl: string | null }>;
    };

    expect(response.status).toBe(200);
    expect(data.programs[0]).toMatchObject({
      id: "program_prepa",
      planPdfUrl: "https://r2.example/Bachillerato/Bachillerato%20UNIDEP%20actualizado.pdf",
      planDownloadUrl:
        "https://r2.example/Bachillerato/Bachillerato%20UNIDEP%20actualizado.pdf?download=1",
    });
  });
});
