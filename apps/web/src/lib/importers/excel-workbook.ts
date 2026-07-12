import fs from "node:fs/promises";

import ExcelJS from "exceljs";
import JSZip from "jszip";

export type ExcelWorkbookInput =
  | { kind: "buffer"; buffer: Uint8Array }
  | { kind: "path"; filePath: string };

export const MAX_EXCEL_WORKBOOK_BYTES = 10 * 1024 * 1024;
const MAX_EXCEL_ARCHIVE_ENTRIES = 2_048;
const MAX_EXCEL_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;

type ExcelArchiveLimits = {
  maxEntries: number;
  maxUncompressedBytes: number;
};

type CompressedZipEntry = JSZip.JSZipObject & {
  _data?: { uncompressedSize?: unknown };
};

export class ExcelWorkbookLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcelWorkbookLimitError";
  }
}

const WORKSHEET_RELATIONSHIPS = /^xl\/worksheets\/_rels\/[^/]+\.rels$/;
const RELATIONSHIP_TAG = /<Relationship\b[^>]*\/>/g;
const TYPE_ATTRIBUTE = /\bType=(["'])(.*?)\1/;
const TARGET_ATTRIBUTE = /\bTarget=(["'])(.*?)\1/;

export function assertSafeExcelArchive(
  zip: JSZip,
  limits: ExcelArchiveLimits = {
    maxEntries: MAX_EXCEL_ARCHIVE_ENTRIES,
    maxUncompressedBytes: MAX_EXCEL_UNCOMPRESSED_BYTES,
  },
) {
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > limits.maxEntries) {
    throw new ExcelWorkbookLimitError(
      `El archivo XLSX contiene demasiadas entradas (máximo ${limits.maxEntries}).`,
    );
  }

  let uncompressedBytes = 0;
  for (const entry of entries) {
    const rawSize = (entry as CompressedZipEntry)._data?.uncompressedSize;
    if (typeof rawSize !== "number" || !Number.isSafeInteger(rawSize) || rawSize < 0) {
      throw new ExcelWorkbookLimitError("El archivo XLSX contiene una entrada inválida.");
    }
    uncompressedBytes += rawSize;
    if (uncompressedBytes > limits.maxUncompressedBytes) {
      throw new ExcelWorkbookLimitError(
        `El archivo XLSX descomprimido supera ${Math.round(limits.maxUncompressedBytes / 1024 / 1024)} MB.`,
      );
    }
  }
}

async function sanitizeWorksheetRelationships(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  assertSafeExcelArchive(zip);
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
  if (rawBuffer.byteLength > MAX_EXCEL_WORKBOOK_BYTES) {
    throw new ExcelWorkbookLimitError(
      `El archivo XLSX supera ${Math.round(MAX_EXCEL_WORKBOOK_BYTES / 1024 / 1024)} MB.`,
    );
  }
  const workbookBuffer = await sanitizeWorksheetRelationships(rawBuffer);
  const workbook = new ExcelJS.Workbook();
  workbook.calcProperties.fullCalcOnLoad = false;
  await workbook.xlsx.load(
    workbookBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  return workbook;
}
