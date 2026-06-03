import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    campus: {
      update: vi.fn(),
    },
    programOffering: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  };

  return {
    txMock: tx,
    prismaMock: {
      program: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx)),
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { applyPreparedAcademicOfferImport } from "@/lib/importers/academic-offer-replace";
import type { PreparedAcademicOfferImportPayload } from "@/lib/importers/academic-offer-replace";

describe("applyPreparedAcademicOfferImport C3 guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.program.findUnique.mockResolvedValue({
      id: "program-pedagogia",
      name: "Pedagogia",
      level: "licenciatura",
      businessLine: "licenciatura",
    });

    txMock.campus.update.mockResolvedValue({});
    txMock.programOffering.count.mockResolvedValue(0);
    txMock.programOffering.deleteMany.mockResolvedValue({ count: 0 });
    txMock.programOffering.createMany.mockResolvedValue({ count: 1 });
  });

  it("merges duplicate C3 rows by cycle + campus + program + module before creating offerings", async () => {
    const payload = {
      cycle: "C3",
      warnings: [],
      detectedSheets: { online: null, planteles: "Planteles" },
      detectedColumns: { online: null, planteles: {} },
      parsed: [
        {
          campusId: "campus-altamira",
          campusCode: "ALT",
          campusNameFromExcel: "Altamira",
          sheetName: "Planteles",
          source: "campus-sheet",
          rows: [
            {
              programName: "Pedagogia",
              programNormalized: "pedagogia",
              level: "licenciatura",
              lineOfBusiness: "licenciatura",
              delivery: "CAMPUS",
              escolarizado: true,
              ejecutivo: false,
              escolarizadoSchedule: "Lunes a viernes 07:00 a 14:00 hrs.",
              ejecutivoSchedule: null,
              pricingPlans: [9],
              module: "Modular",
              moduleCount: 2,
              subjectsByModule: "2 materias por modulo",
            },
            {
              programName: "Pedagogia",
              programNormalized: "pedagogia",
              level: "licenciatura",
              lineOfBusiness: "licenciatura",
              delivery: "CAMPUS",
              escolarizado: false,
              ejecutivo: true,
              escolarizadoSchedule: null,
              ejecutivoSchedule: "Sabado 08:00 a 15:00 hrs.",
              pricingPlans: [11],
              module: "Modular",
              moduleCount: null,
              subjectsByModule: null,
            },
          ],
        },
      ],
    } as unknown as PreparedAcademicOfferImportPayload;

    const summary = await applyPreparedAcademicOfferImport({
      payload,
      updatedBy: "admin@example.com",
    });

    expect(txMock.programOffering.createMany).toHaveBeenCalledTimes(1);
    const createManyArg = txMock.programOffering.createMany.mock.calls[0]?.[0];
    expect(createManyArg.data).toHaveLength(1);

    expect(createManyArg.data[0]).toEqual(
      expect.objectContaining({
        campusId: "campus-altamira",
        programId: "program-pedagogia",
        cycle: "C3",
        delivery: "CAMPUS",
        escolarizado: true,
        ejecutivo: true,
        escolarizadoSchedule: "Lunes a viernes 07:00 a 14:00 hrs.",
        ejecutivoSchedule: "Sabado 08:00 a 15:00 hrs.",
        lineOfBusiness: "licenciatura",
        pricingPlans: [9, 11],
        track: "Modular",
        moduleCount: 2,
        subjectsByModule: "2 materias por modulo",
        isActive: true,
      }),
    );

    expect(summary.offerings.created).toBe(1);
    expect(summary.perCampus).toEqual([
      expect.objectContaining({
        campusCode: "ALT",
        campusName: "Altamira",
        rows: 2,
        offeringsCreated: 1,
      }),
    ]);
  });
});
