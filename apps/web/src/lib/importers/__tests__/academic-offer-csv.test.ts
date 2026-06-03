import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { academicOfferCsvToXlsxBuffer } from "@/lib/importers/academic-offer-csv";
import { getAdminImportTemplate } from "@/lib/importers/admin-import-templates";

describe("academicOfferCsvToXlsxBuffer", () => {
  it("maps the offer-by-campus CSV template to plantel rows with schedules", async () => {
    const csv = [
      "Ciclo,Plantel,Programa,Línea,Modalidad,Plan,Modulo,No. de modulos,Horario escolarizado,Horario ejecutivo,Estado",
      "C1,Los Cabos,Derecho,licenciatura,mixta,9,M2,3,L-V 08:00-13:00,Sáb 09:00-14:00,Activo",
      "C1,Hermosillo,Psicologia,licenciatura,presencial,9,,2,L-V 08:00-13:00,,Inactivo",
      "C1,Online,Psicologia,licenciatura,online,9,Longitudinal,1,,,Activo",
    ].join("\n");

    const buffer = await academicOfferCsvToXlsxBuffer(Buffer.from(csv, "utf8"));
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    await workbook.xlsx.load(arrayBuffer);

    const planteles = workbook.getWorksheet("Planteles");
    expect(planteles).toBeDefined();
    expect(planteles?.rowCount).toBe(3);
    expect(planteles?.getRow(1).values).toEqual([
      undefined,
      "Ciclo",
      "Plantel",
      "Programa",
      "Línea",
      "Modalidad",
      "Plan",
      "Modulo",
      "No. de modulos",
      "Horario escolarizado",
      "Horario ejecutivo",
      "Estado",
    ]);
    expect(planteles?.getRow(2).values).toEqual([
      undefined,
      "C1",
      "Los Cabos",
      "Derecho",
      "licenciatura",
      "mixta",
      "9",
      "M2",
      "3",
      "L-V 08:00-13:00",
      "Sáb 09:00-14:00",
      "Activo",
    ]);
    expect(planteles?.getRow(3).values).toEqual([
      undefined,
      "C1",
      "Online",
      "Psicologia",
      "licenciatura",
      "online",
      "9",
      "Longitudinal",
      "1",
      "",
      "",
      "Activo",
    ]);
  });

  it("keeps the downloadable template aligned with the CSV importer", () => {
    const template = getAdminImportTemplate("academic-offer");

    expect(template?.headers).toEqual([
      "Ciclo",
      "Plantel",
      "Programa",
      "Línea",
      "Modalidad",
      "Plan",
      "Modulo",
      "No. de modulos",
      "Horario escolarizado",
      "Horario ejecutivo",
      "Estado",
    ]);
  });
});
