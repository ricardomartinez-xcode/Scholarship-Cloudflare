import fs from "node:fs/promises";

import ExcelJS from "exceljs";
import JSZip from "jszip";

export type ExcelWorkbookInput =
  | { kind: "buffer"; buffer: Uint8Array }
  | { kind: "path"; filePath: string };

const WORKSHEET_RELATIONSHIPS = /^xl\/worksheets\/_rels\/[^/]+\.rels$/;
const RELATIONSHIP_TAG = /<Relationship\b[^>]*\/>/g;
const TYPE_ATTRIBUTE = /\bType=(["'])(.*?)\1/;
const TARGET_ATTRIBUTE = /\bTarget=(["'])(.*?)\1/;

async function sanitizeWorksheetRelationships(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;

  for (const fileName of Object.keys(zip.files)) {
    if (!WORKSHEET_RELATIONSHIPS.test(fileName)) continue;

    const entry = zip.file(fileName);
    if (!entry) continue;

    const xml = await entry.async("string");
    const normalized = xml.replace(RELATIONSHIP_TAG, (relationship) => {
      const type = relationship.match(TYPE_ATTRIBUTE)?.[2] ?? "";
      const target = relationship.match(TARGET_ATTRIBUTE)?.[2] ?? "";
      const isUnsupportedComment =
        target.startsWith("/xl/") &&
        (type.endsWith("/comments") || type.endsWith("/vmlDrawing"));
      return isUnsupportedComment ? "" : relationship;
    });

    if (normalized !== xml) {
      zip.file(fileName, normalized);
      changed = true;
    }
  }

  if (!changed) return buffer;

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function loadExcelWorkbook(input: ExcelWorkbookInput): Promise<ExcelJS.Workbook> {
  const rawBuffer =
    input.kind === "path" ? await fs.readFile(input.filePath) : Buffer.from(input.buffer);
  const workbookBuffer = await sanitizeWorksheetRelationships(rawBuffer);
  const workbook = new ExcelJS.Workbook();
  workbook.calcProperties.fullCalcOnLoad = false;
  await workbook.xlsx.load(
    workbookBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  return workbook;
}
