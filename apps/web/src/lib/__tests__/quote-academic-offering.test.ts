import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    campus: {
      findFirst: vi.fn(),
    },
    programOffering: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { resolveQuoteAcademicOffering } from "@/lib/quote-academic-offering";

const HERMOSILLO_OFFERING = {
  id: "11111111-1111-4111-8111-111111111111",
  cycle: "C1",
  lineOfBusiness: "Licenciatura",
  delivery: "CAMPUS",
  escolarizado: true,
  ejecutivo: false,
  campus: {
    id: "22222222-2222-4222-8222-222222222222",
    code: "CAMPUS_HERMOSILLO",
    metaKey: "Hermosillo",
    name: "Hermosillo",
    slug: "hermosillo",
    tier: "T3",
    kind: "campus",
  },
  program: {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Licenciatura en Derecho",
    businessLine: "licenciatura",
    level: "Licenciatura",
    category: "Derecho",
  },
} as const;

describe("resolveQuoteAcademicOffering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives quote context from an active offeringId", async () => {
    prismaMock.programOffering.findFirst.mockResolvedValue(HERMOSILLO_OFFERING);

    const result = await resolveQuoteAcademicOffering({
      offeringId: HERMOSILLO_OFFERING.id,
      selectedProgramId: HERMOSILLO_OFFERING.program.id,
      businessLine: "licenciatura",
      modality: "presencial",
      campus: "Hermosillo",
    });

    expect(result).toEqual({
      ok: true,
      warnings: [],
      context: expect.objectContaining({
        offeringId: HERMOSILLO_OFFERING.id,
        businessLine: "licenciatura",
        modality: "presencial",
        programId: HERMOSILLO_OFFERING.program.id,
        campusKey: "Hermosillo",
        campusTier: "T3",
      }),
    });
  });

  it("resolves an active offering from program, campus, line and modality when offeringId is not sent", async () => {
    prismaMock.campus.findFirst.mockResolvedValue({ id: HERMOSILLO_OFFERING.campus.id });
    prismaMock.programOffering.findMany.mockResolvedValue([HERMOSILLO_OFFERING]);

    const result = await resolveQuoteAcademicOffering({
      selectedProgramId: HERMOSILLO_OFFERING.program.id,
      businessLine: "licenciatura",
      modality: "presencial",
      campus: "Hermosillo",
      cycle: "C1",
    });

    expect(prismaMock.programOffering.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programId: HERMOSILLO_OFFERING.program.id,
          campusId: HERMOSILLO_OFFERING.campus.id,
          cycle: "C1",
        }),
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context).toEqual(expect.objectContaining({
        offeringId: HERMOSILLO_OFFERING.id,
        businessLine: "licenciatura",
        modality: "presencial",
        campusKey: "Hermosillo",
      }));
    }
  });

  it("keeps backward compatibility when no offering can be resolved", async () => {
    prismaMock.campus.findFirst.mockResolvedValue({ id: HERMOSILLO_OFFERING.campus.id });
    prismaMock.programOffering.findMany.mockResolvedValue([]);

    const result = await resolveQuoteAcademicOffering({
      selectedProgramId: HERMOSILLO_OFFERING.program.id,
      businessLine: "licenciatura",
      modality: "presencial",
      campus: "Hermosillo",
    });

    expect(result).toEqual({
      ok: true,
      context: null,
      warnings: ["offering_not_resolved"],
    });
  });
});
