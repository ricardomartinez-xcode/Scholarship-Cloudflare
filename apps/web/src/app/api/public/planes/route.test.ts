import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock, logPublicRouteTimingMock, prismaMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
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

vi.mock("@/lib/r2-content-bucket", () => ({
  listContentBucketObjects: vi.fn().mockResolvedValue([]),
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
});
