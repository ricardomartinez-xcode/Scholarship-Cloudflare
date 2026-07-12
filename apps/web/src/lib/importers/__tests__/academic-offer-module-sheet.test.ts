import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { enrichAcademicOfferImportWithModuleSheet } from "@/lib/importers/academic-offer-module-sheet";
import type {
  AcademicOfferPreviewRow,
  ImportAcademicOfferSummary,
  PreparedAcademicOfferImportPayload,
} from "@/lib/importers/academic-offer";

type PreparedForTest = {
  summary: Pick<ImportAcademicOfferSummary, "warnings" | "detectedSheets" | "detectedColumns">;
  previewRows: AcademicOfferPreviewRow[];
  payload: PreparedAcademicOfferImportPayload;
};

async function moduleWorkbookBuffer(moduleValue: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Planteles");
  sheet.addRow(["Plantel", "Programa", "Modulo", "Estado"]);
  sheet.addRow(["Hermosillo", "Derecho", moduleValue, "Activo"]);
  const buffer = await workbook.xlsx.writeBuffer();
  return Uint8Array.from(buffer as unknown as ArrayLike<number>);
}

function preparedOffer(): PreparedForTest {
  return {
    summary: {
      warnings: [],
      detectedSheets: { online: null, planteles: "Planteles" },
      detectedColumns: null,
    },
    previewRows: [
      {
        id: "HMO:derecho:Longitudinal",
        campusCode: "HMO",
        campusName: "Hermosillo",
        cycle: "C1",
        programName: "Derecho",
        line: "licenciatura",
        modality: "Escolarizado",
        pricingPlans: [9],
        module: "Longitudinal",
        moduleCount: null,
        subjectsByModule: null,
        isActive: true,
        hasPlanPdf: false,
        hasBrochurePdf: false,
      },
    ],
    payload: {
      cycle: "C1",
      warnings: [],
      detectedSheets: { online: null, planteles: "Planteles" },
      detectedColumns: null,
      parsed: [
        {
          campusId: "campus-hmo",
          campusCode: "HMO",
          sheetName: "Planteles",
          campusNameFromExcel: "Hermosillo",
          source: "campus-sheet",
          rows: [
            {
              programName: "Derecho",
              programNormalized: "derecho",
              level: null,
              lineOfBusiness: "licenciatura",
              escolarizado: true,
              ejecutivo: false,
              escolarizadoSchedule: null,
              ejecutivoSchedule: null,
              delivery: "CAMPUS",
              pricingPlans: [9],
              module: "Longitudinal",
              moduleCount: null,
              subjectsByModule: null,
            },
          ],
        },
      ],
    },
  };
}

function payloadModules(prepared: ReturnType<typeof preparedOffer>) {
  return prepared.payload.parsed.flatMap((campus) =>
    campus.rows.map((row) => row.module),
  );
}

function previewModules(prepared: ReturnType<typeof preparedOffer>) {
  return prepared.previewRows.map((row) => row.module);
}

describe("enrichAcademicOfferImportWithModuleSheet", () => {
  it("ignores historical comparison sheets when detecting module configuration", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Comparativo 22 vs 24");
    sheet.addRow(["Programa", "M1", "M2", "M3"]);
    sheet.addRow(["Derecho", true, true, true]);
    const buffer = await workbook.xlsx.writeBuffer();
    const prepared = preparedOffer();

    const enriched = await enrichAcademicOfferImportWithModuleSheet({
      input: {
        kind: "buffer",
        buffer: Uint8Array.from(buffer as unknown as ArrayLike<number>),
        fileName: "oferta.xlsx",
      },
      prepared,
    });

    expect(payloadModules(enriched)).toEqual(["Longitudinal"]);
    expect(previewModules(enriched)).toEqual(["Longitudinal"]);
    expect(enriched.summary.warnings).toEqual([]);
  });

  it("preserves explicitly selected M1 and M2 instead of collapsing them to Modular", async () => {
    const prepared = preparedOffer();

    const enriched = await enrichAcademicOfferImportWithModuleSheet({
      input: {
        kind: "buffer",
        buffer: await moduleWorkbookBuffer("M1 y M2"),
        fileName: "oferta.xlsx",
      },
      prepared,
    });

    expect(payloadModules(enriched)).toEqual(["M1", "M2"]);
    expect(previewModules(enriched)).toEqual(["M1", "M2"]);
    expect(enriched.summary.warnings[0]).toContain("módulos explícitos");
    expect(enriched.summary.warnings[0]).not.toContain("M1, M2, M3");
  });

  it("preserves explicit Modular and Longitudinal tracks from the module column", async () => {
    const prepared = preparedOffer();

    const enriched = await enrichAcademicOfferImportWithModuleSheet({
      input: {
        kind: "buffer",
        buffer: await moduleWorkbookBuffer("Modular y Longitudinal"),
        fileName: "oferta.xlsx",
      },
      prepared,
    });

    expect(payloadModules(enriched)).toEqual(["Modular", "Longitudinal"]);
    expect(previewModules(enriched)).toEqual(["Modular", "Longitudinal"]);
  });

  it("keeps explicit Modular as one track while inferring its module count from listed parts", async () => {
    const prepared = preparedOffer();

    const enriched = await enrichAcademicOfferImportWithModuleSheet({
      input: {
        kind: "buffer",
        buffer: await moduleWorkbookBuffer("Modular M1, M2, M3"),
        fileName: "oferta.xlsx",
      },
      prepared,
    });

    expect(payloadModules(enriched)).toEqual(["Modular"]);
    expect(enriched.payload.parsed[0]?.rows[0]).toMatchObject({
      module: "Modular",
      moduleCount: 3,
    });
    expect(previewModules(enriched)).toEqual(["Modular"]);
    expect(enriched.previewRows[0]).toMatchObject({
      module: "Modular",
      moduleCount: 3,
    });
  });
});
