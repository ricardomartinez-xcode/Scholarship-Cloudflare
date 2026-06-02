import type { PublicFileAssetPayload } from "@/lib/file-assets";

export type CtaPopupTable = {
  columns: string[];
  rows: string[][];
};

export type CtaActionConfig = {
  type: "popup";
  title: string;
  message: string | null;
  image: PublicFileAssetPayload | null;
  table: CtaPopupTable | null;
};

type CtaActionInput = {
  type?: unknown;
  title?: unknown;
  message?: unknown;
  image?: unknown;
  tableRaw?: unknown;
};

const MAX_TABLE_COLUMNS = 8;
const MAX_TABLE_ROWS = 50;
const CTA_ACTION_RULE_KEY = "ctaAction";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 1200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeImage(value: unknown): PublicFileAssetPayload | null {
  if (!isRecord(value)) return null;

  const fileId = cleanText(value.fileId, 128);
  const fileName = cleanText(value.fileName, 260);
  const mimeType = cleanText(value.mimeType, 160);
  const previewUrl = cleanText(value.previewUrl, 500);
  const downloadUrl = cleanText(value.downloadUrl, 500);
  const sizeBytesRaw = Number(value.sizeBytes ?? 0);

  if (!fileId || !fileName || !mimeType || !previewUrl || !downloadUrl) {
    return null;
  }

  return {
    fileId,
    fileName,
    mimeType,
    sizeBytes: Number.isFinite(sizeBytesRaw) && sizeBytesRaw > 0 ? Math.trunc(sizeBytesRaw) : null,
    previewUrl,
    downloadUrl,
  };
}

function splitTableLine(line: string) {
  const separator = line.includes("|") ? "|" : line.includes("\t") ? "\t" : ",";
  return line
    .split(separator)
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0)
    .slice(0, MAX_TABLE_COLUMNS);
}

export function parseCtaPopupTable(raw: unknown): CtaPopupTable | null {
  const text = cleanText(raw, 4000);
  if (!text) return null;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;

  const columns = splitTableLine(lines[0]);
  if (!columns.length) return null;

  const rows = lines
    .slice(1, MAX_TABLE_ROWS + 1)
    .map((line) => {
      const cells = splitTableLine(line);
      return columns.map((_, index) => cells[index] ?? "");
    })
    .filter((row) => row.some(Boolean));

  if (!rows.length) return null;
  return { columns, rows };
}

export function normalizeCtaActionConfig(raw: unknown): CtaActionConfig | null {
  if (!isRecord(raw) || raw.type !== "popup") return null;

  const title = cleanText(raw.title, 160) || "Información";
  const message = cleanText(raw.message, 2000) || null;
  const table = isRecord(raw.table)
    ? normalizeStoredTable(raw.table)
    : parseCtaPopupTable(raw.tableRaw);
  const image = normalizeImage(raw.image);

  if (!message && !table && !image) return null;

  return {
    type: "popup",
    title,
    message,
    image,
    table,
  };
}

function normalizeStoredTable(raw: Record<string, unknown>): CtaPopupTable | null {
  const columns = Array.isArray(raw.columns)
    ? raw.columns.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, MAX_TABLE_COLUMNS)
    : [];
  const rows = Array.isArray(raw.rows)
    ? raw.rows
        .slice(0, MAX_TABLE_ROWS)
        .map((row) =>
          Array.isArray(row)
            ? columns.map((_, index) => cleanText(row[index], 240))
            : [],
        )
        .filter((row) => row.some(Boolean))
    : [];

  if (!columns.length || !rows.length) return null;
  return { columns, rows };
}

export function parseCtaActionImageJson(raw: unknown): PublicFileAssetPayload | null {
  const text = cleanText(raw, 3000);
  if (!text) return null;
  try {
    return normalizeImage(JSON.parse(text));
  } catch {
    return null;
  }
}

export function buildCtaActionConfig(input: CtaActionInput): CtaActionConfig | null {
  if (input.type !== "popup") return null;
  return normalizeCtaActionConfig({
    type: "popup",
    title: input.title,
    message: input.message,
    tableRaw: input.tableRaw,
    image: normalizeImage(input.image),
  });
}

export function extractCtaActionConfigFromRule(raw: unknown): CtaActionConfig | null {
  if (!isRecord(raw)) return null;
  return normalizeCtaActionConfig(raw[CTA_ACTION_RULE_KEY]);
}

export function mergeCtaActionConfigIntoVisibilityRule(
  visibilityRule: unknown,
  actionConfig: CtaActionConfig | null,
) {
  const base = isRecord(visibilityRule) ? { ...visibilityRule } : {};
  delete base[CTA_ACTION_RULE_KEY];

  if (!actionConfig) return base;

  return {
    ...base,
    [CTA_ACTION_RULE_KEY]: actionConfig,
  };
}
