import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  assertSafeExcelArchive,
  ExcelWorkbookLimitError,
  loadExcelWorkbook,
} from "@/lib/importers/excel-workbook";

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

  it("rejects archives with too many entries before ExcelJS processes them", async () => {
    const source = new JSZip();
    source.file("first.xml", "a");
    source.file("second.xml", "b");
    const zip = await JSZip.loadAsync(await source.generateAsync({ type: "uint8array" }));

    expect(() =>
      assertSafeExcelArchive(zip, { maxEntries: 1, maxUncompressedBytes: 10 }),
    ).toThrow(ExcelWorkbookLimitError);
  });

  it("rejects archives whose uncompressed content exceeds the limit", async () => {
    const source = new JSZip();
    source.file("large.xml", "abcd");
    const zip = await JSZip.loadAsync(await source.generateAsync({ type: "uint8array" }));

    expect(() =>
      assertSafeExcelArchive(zip, { maxEntries: 2, maxUncompressedBytes: 3 }),
    ).toThrow(/descomprimido supera/);
  });
});
