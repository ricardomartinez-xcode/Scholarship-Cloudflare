import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { academicOfferCsvToXlsxBuffer } from "@/lib/importers/academic-offer-csv";
import { getAdminImportTemplate } from "@/lib/importers/admin-import-templates";

describe("academicOfferCsvToXlsxBuffer", () => {
  it("maps the offer-by-campus CSV template to plantel rows with schedules", async () => {
    const csv = [
      "ciclo,plantel,programa,linea,modalidad,plan,horario,horario_escolarizado,horario_ejecutivo,activo",
      "C1,Los Cabos,Derecho,licenciatura,mixta,9,,L-V 08:00-13:00,Sáb 09:00-14:00,true",
      "C1,Hermosillo,Psicologia,licenciatura,presencial,9,L-V 08:00-13:00,,,false",
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
    expect(planteles?.rowCount).toBe(2);
    expect(planteles?.getRow(2).values).toEqual([
      undefined,
      "Los Cabos",
      "Derecho",
      "SI",
      "SI",
      "L-V 08:00-13:00",
      "Sáb 09:00-14:00",
      "9",
    ]);
  });

  it("keeps the downloadable template aligned with the CSV importer", () => {
    const template = getAdminImportTemplate("academic-offer");

    expect(template?.headers).toEqual([
      "ciclo",
      "plantel",
      "programa",
      "linea",
      "modalidad",
      "plan",
      "horario",
      "horario_escolarizado",
      "horario_ejecutivo",
      "activo",
      "notas",
    ]);
  });
});
