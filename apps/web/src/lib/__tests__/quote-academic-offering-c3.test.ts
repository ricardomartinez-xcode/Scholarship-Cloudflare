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

const C3_MERGED_MODULAR_OFFERING = {
  id: "11111111-1111-4111-8111-111111111111",
  cycle: "C3",
  track: "Modular",
  subjectsByModule: "2 materias por modulo",
  moduleCount: 2,
  lineOfBusiness: "licenciatura",
  pricingPlans: [9, 11],
  delivery: "CAMPUS",
  escolarizado: true,
  ejecutivo: true,
  campus: {
    id: "22222222-2222-4222-8222-222222222222",
    code: "ALT",
    metaKey: "Altamira",
    name: "Altamira",
    slug: "altamira",
    tier: "T3",
    kind: "campus",
  },
  program: {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Pedagogia",
    businessLine: "licenciatura",
    level: "licenciatura",
    category: "licenciatura",
  },
} as const;

describe("resolveQuoteAcademicOffering C3 guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.campus.findFirst.mockResolvedValue({ id: C3_MERGED_MODULAR_OFFERING.campus.id });
  });

  it.each([
    ["presencial", "presencial"],
    ["ejecutivo", "mixta"],
  ] as const)(
    "resolves a merged C3 Modular offering for requested modality %s",
    async (requestedModality, expectedCanonicalModality) => {
      prismaMock.programOffering.findMany
        .mockResolvedValueOnce([C3_MERGED_MODULAR_OFFERING])
        .mockResolvedValueOnce([
          {
            id: C3_MERGED_MODULAR_OFFERING.id,
            subjectsByModule: C3_MERGED_MODULAR_OFFERING.subjectsByModule,
            moduleCount: C3_MERGED_MODULAR_OFFERING.moduleCount,
          },
        ]);

      const result = await resolveQuoteAcademicOffering({
        selectedProgramId: C3_MERGED_MODULAR_OFFERING.program.id,
        businessLine: "licenciatura",
        modality: requestedModality,
        campus: "Altamira",
        plan: 11,
        module: "Modular",
        cycle: "C3",
      });

      expect(prismaMock.programOffering.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            programId: C3_MERGED_MODULAR_OFFERING.program.id,
            campusId: C3_MERGED_MODULAR_OFFERING.campus.id,
            cycle: "C3",
          }),
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.context).toEqual(
        expect.objectContaining({
          offeringId: C3_MERGED_MODULAR_OFFERING.id,
          cycle: "C3",
          businessLine: "licenciatura",
          modality: expectedCanonicalModality,
          programId: C3_MERGED_MODULAR_OFFERING.program.id,
          campusKey: "Altamira",
          pricingPlans: [9, 11],
          module: "Modular",
          subjectsByModule: "2 materias por modulo",
        }),
      );
      expect(result.warnings).toEqual([]);
    },
  );
});
