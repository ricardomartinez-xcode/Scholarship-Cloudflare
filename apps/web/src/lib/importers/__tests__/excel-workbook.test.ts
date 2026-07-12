import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { loadExcelWorkbook } from "@/lib/importers/excel-workbook";

async function workbookWithAbsoluteCommentTargets() {
  const source = new ExcelJS.Workbook();
  const sheet = source.addWorksheet("Oferta");
  sheet.getCell("A1").value = "Programa";
  sheet.getCell("A1").note = "Comentario de validación";

  const zip = await JSZip.loadAsync(await source.xlsx.writeBuffer());
  const relationshipsPath = "xl/worksheets/_rels/sheet1.xml.rels";
  const relationships = zip.file(relationshipsPath);
  if (!relationships) throw new Error("No se generaron relaciones para la hoja de prueba.");

  const xml = await relationships.async("string");
  zip.file(
    relationshipsPath,
    xml
      .replace('Target="../comments1.xml"', 'Target="/xl/comments1.xml"')
      .replace(
        'Target="../drawings/vmlDrawing1.vml"',
        'Target="/xl/drawings/vmlDrawing1.vml"',
      ),
  );

  return zip.generateAsync({ type: "uint8array" });
}

describe("loadExcelWorkbook", () => {
  it("discards unsupported absolute comment relationships before ExcelJS reconciliation", async () => {
    const buffer = await workbookWithAbsoluteCommentTargets();

    const workbook = await loadExcelWorkbook({ kind: "buffer", buffer });

    expect(workbook.getWorksheet("Oferta")?.getCell("A1").value).toBe("Programa");
    expect(workbook.getWorksheet("Oferta")?.getCell("A1").note).toBeUndefined();
  });
});
