import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    campus: { findMany: vi.fn() },
    program: { findMany: vi.fn() },
    programOffering: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { academicOfferCsvToXlsxBuffer } from "@/lib/importers/academic-offer-csv";
import { prepareAcademicOfferImport } from "@/lib/importers/academic-offer";

describe("prepareAcademicOfferImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.campus.findMany.mockResolvedValue([
      {
        id: "campus-online",
        code: "ONLINE",
        name: "Online",
        metaKey: "ONLINE",
        kind: "online",
      },
      {
        id: "campus-hermosillo",
        code: "HMO",
        name: "Hermosillo",
        metaKey: "Hermosillo",
        kind: "campus",
      },
    ]);
    prismaMock.program.findMany.mockResolvedValue([]);
    prismaMock.programOffering.findMany.mockResolvedValue([]);
  });

  it("uses the Linea column from the flat offer template for campus preview rows", async () => {
    const csv = [
      "Ciclo,Plantel,Programa,Línea,Modalidad,Plan,Modulo,No. de modulos,Materias por módulo,Horario escolarizado,Horario ejecutivo,Estado",
      "C1,Hermosillo,Enfermería,salud,presencial,9,\"Modular M1, M2, M3\",3,\"9=(M1=2,M2=2,M3=1);11=(M1=1,M2=2,M3=1)\",L-V 08:00-13:00,,Activo",
    ].join("\n");
    const buffer = await academicOfferCsvToXlsxBuffer(Buffer.from(csv, "utf8"));

    const prepared = await prepareAcademicOfferImport({
      input: { kind: "buffer", buffer, fileName: "oferta.csv" },
      cycle: "C1",
      aliasRows: [],
    });

    expect(prepared.previewRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campusCode: "HMO",
          programName: "Enfermería",
          line: "salud",
          modality: "Escolarizado",
          pricingPlans: [9],
          module: "Modular",
          moduleCount: 3,
          subjectsByModule: "9=(M1=2,M2=2,M3=1);11=(M1=1,M2=2,M3=1)",
        }),
      ]),
    );
  });
});
