import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  getPublishedConfigSnapshotMock,
  getAcademicOfferVisibleCyclesMock,
  logPublicRouteTimingMock,
  prismaMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getPublishedConfigSnapshotMock: vi.fn(),
  getAcademicOfferVisibleCyclesMock: vi.fn(),
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
});
