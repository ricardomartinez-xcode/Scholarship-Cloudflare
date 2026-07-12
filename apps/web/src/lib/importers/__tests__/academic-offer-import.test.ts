import ExcelJS from "exceljs";
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
          programName: "Licenciatura en Enfermería",
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

  it("uses the latest requested cycle from per-campus sheets and only current Online programs", async () => {
    const workbook = new ExcelJS.Workbook();
    const online = workbook.addWorksheet("Online");
    online.addRow([
      "Licenciatura Online Actual",
      "Clusters",
      "",
      "Licenciatura Online Nuevos Programas",
      "Clusters",
    ]);
    online.addRow([
      "Licenciatura en Administración de Empresas",
      "Económico Administrativas",
      "",
      "Licenciatura en Programa Futuro",
      "Económico Administrativas",
    ]);
    online.addRow([]);
    online.addRow(["Posgrado Online Actual", "Clusters"]);
    online.addRow(["Maestría en Administración de Negocios", "Negocios"]);

    const campus = workbook.addWorksheet("Hermosillo");
    campus.addRow(["", "C1 2025", "2025", "2025"]);
    campus.addRow(["", "C1 2025", "Escolarizado", "Ejecutivo"]);
    campus.addRow(["modular", "Licenciatura en Mercadotecnia", true, false]);
    campus.addRow([]);
    campus.addRow(["", "C1 2026", "2026", "2026", "", "", "", "HORARIOS", "", "HORARIOS"]);
    campus.addRow(["", "C1 2026", "Escolarizado", "Ejecutivo", "", "", "", "Escolarizado", "", "Ejecutivo"]);
    campus.addRow([
      "modular",
      "Licenciatura en Enfermería",
      true,
      false,
      "",
      "",
      "",
      "Lunes a viernes 7:00 a 14:00",
    ]);
    campus.addRow([
      "longitudinal",
      "Licenciatura en Derecho",
      false,
      true,
      "",
      "",
      "",
      "",
      "",
      "Sábados 8:00 a 14:00",
    ]);

    const buffer = await workbook.xlsx.writeBuffer();
    const prepared = await prepareAcademicOfferImport({
      input: {
        kind: "buffer",
        buffer: Uint8Array.from(buffer as unknown as ArrayLike<number>),
        fileName: "oferta-real.xlsx",
      },
      cycle: "C1",
      aliasRows: [],
    });

    expect(prepared.summary.detectedSheets.planteles).toBe("Hojas por plantel (1)");
    expect(prepared.summary.detectedColumns).toBeNull();
    expect(prepared.previewRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campusCode: "HMO",
          programName: "Licenciatura en Enfermería",
          line: "salud",
          modality: "Escolarizado",
          module: "Modular",
        }),
        expect.objectContaining({
          campusCode: "HMO",
          programName: "Licenciatura en Derecho",
          line: "licenciatura",
          modality: "Ejecutivo",
          module: "Longitudinal",
        }),
        expect.objectContaining({
          campusCode: "ONLINE",
          programName: "Licenciatura en Administración de Empresas",
        }),
        expect.objectContaining({
          campusCode: "ONLINE",
          programName: "Maestría en Administración de Negocios",
          line: "posgrado",
        }),
      ]),
    );
    expect(prepared.previewRows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ programName: "Licenciatura en Mercadotecnia" }),
        expect.objectContaining({ programName: "Licenciatura en Programa Futuro" }),
      ]),
    );
  });
});
