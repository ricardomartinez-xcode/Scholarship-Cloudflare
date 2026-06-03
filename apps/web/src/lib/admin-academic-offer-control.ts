import {
  normalizeAcademicOfferCycle,
  type AcademicOfferCycle,
} from "@/config/academicOffer";
import {
  academicOfferRowsToCsvText,
  inferAcademicOfferCycle,
  normalizeAcademicOfferRows,
  parseAcademicOfferCsvRows,
  validateAcademicOfferRows,
  type AcademicOfferRowError,
  type NormalizedAcademicOfferRow,
} from "@/lib/admin-control-api";
import {
  academicOfferCsvToXlsxBuffer,
  isAcademicOfferCsvFileName,
} from "@/lib/importers/academic-offer-csv";
import type { ImportAcademicOfferInput } from "@/lib/importers/academic-offer";

type AcademicOfferJsonPayload = {
  cycle?: unknown;
  dryRun?: unknown;
  csv?: unknown;
  rows?: unknown;
  fileName?: unknown;
};

export type AcademicOfferControlInput =
  | {
      ok: true;
      cycle: AcademicOfferCycle;
      dryRun: boolean;
      input: ImportAcademicOfferInput;
      checksumBuffer: Buffer;
      fileName: string;
      rowErrors: [];
    }
  | {
      ok: false;
      status: number;
      errorCode: string;
      error: string;
      rowErrors: AcademicOfferRowError[];
    };

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "si", "sí", "yes"].includes(normalized)) return true;
    if (["0", "false", "no"].includes(normalized)) return false;
  }
  return fallback;
}

function invalidCycle(rowErrors: AcademicOfferRowError[] = []): AcademicOfferControlInput {
  return {
    ok: false,
    status: 400,
    errorCode: "INVALID_CYCLE",
    error: "Envía un ciclo único válido: C1, C2 o C3.",
    rowErrors,
  };
}

function resolveCycle(
  rows: NormalizedAcademicOfferRow[],
  explicitCycle: unknown,
): AcademicOfferCycle | null {
  if (typeof explicitCycle === "string" && explicitCycle.trim()) {
    return normalizeAcademicOfferCycle(explicitCycle);
  }
  return inferAcademicOfferCycle(rows);
}

async function buildImportFromRows(params: {
  rows: NormalizedAcademicOfferRow[];
  explicitCycle?: unknown;
  dryRun?: unknown;
  fileName?: unknown;
}): Promise<AcademicOfferControlInput> {
  const validation = validateAcademicOfferRows(params.rows);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      errorCode: "INVALID_ROWS",
      error: "La oferta académica contiene errores por fila.",
      rowErrors: validation.rowErrors,
    };
  }

  const cycle = resolveCycle(params.rows, params.explicitCycle);
  if (!cycle) return invalidCycle();

  const csvText = academicOfferRowsToCsvText(params.rows);
  const checksumBuffer = Buffer.from(csvText, "utf8");
  const xlsxBuffer = await academicOfferCsvToXlsxBuffer(checksumBuffer);
  const fileName = String(params.fileName ?? "").trim() || "academic-offer-json.csv";

  return {
    ok: true,
    cycle,
    dryRun: toBoolean(params.dryRun),
    input: { kind: "buffer", buffer: xlsxBuffer, fileName },
    checksumBuffer,
    fileName,
    rowErrors: [],
  };
}

export async function resolveAcademicOfferJsonImport(
  payload: AcademicOfferJsonPayload,
): Promise<AcademicOfferControlInput> {
  if (typeof payload.csv === "string" && payload.csv.trim()) {
    const rows = parseAcademicOfferCsvRows(payload.csv);
    if (!rows.length) {
      return {
        ok: false,
        status: 400,
        errorCode: "EMPTY_CSV",
        error: "El CSV debe incluir encabezados y al menos una fila de datos.",
        rowErrors: [],
      };
    }

    return buildImportFromRows({
      rows,
      explicitCycle: payload.cycle,
      dryRun: payload.dryRun,
      fileName: payload.fileName ?? "academic-offer.csv",
    });
  }

  if (Array.isArray(payload.rows)) {
    return buildImportFromRows({
      rows: normalizeAcademicOfferRows(
        payload.rows.filter(
          (row): row is Record<string, unknown> =>
            Boolean(row) && typeof row === "object" && !Array.isArray(row),
        ),
      ),
      explicitCycle: payload.cycle,
      dryRun: payload.dryRun,
      fileName: payload.fileName,
    });
  }

  return {
    ok: false,
    status: 400,
    errorCode: "INVALID_PAYLOAD",
    error: "Envía un archivo CSV/XLSX o payload JSON con csv o rows.",
    rowErrors: [],
  };
}

export async function resolveAcademicOfferFormImport(form: FormData): Promise<AcademicOfferControlInput> {
  const maybeFile = form.get("file");
  if (!maybeFile || typeof maybeFile !== "object" || !("arrayBuffer" in maybeFile)) {
    return {
      ok: false,
      status: 400,
      errorCode: "MISSING_FILE",
      error: "Sube un archivo .csv o .xlsx.",
      rowErrors: [],
    };
  }

  const file = maybeFile as File;
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const dryRun = toBoolean(form.get("dryRun"));

  if (isAcademicOfferCsvFileName(file.name) || file.type === "text/csv") {
    const csvText = originalBuffer.toString("utf8");
    const rows = parseAcademicOfferCsvRows(csvText);
    const cycle = resolveCycle(rows, form.get("cycle"));
    if (!cycle) return invalidCycle();

    const validation = validateAcademicOfferRows(rows);
    if (!validation.ok) {
      return {
        ok: false,
        status: 400,
        errorCode: "INVALID_ROWS",
        error: "La oferta académica contiene errores por fila.",
        rowErrors: validation.rowErrors,
      };
    }

    return {
      ok: true,
      cycle,
      dryRun,
      input: {
        kind: "buffer",
        buffer: await academicOfferCsvToXlsxBuffer(originalBuffer),
        fileName: file.name,
      },
      checksumBuffer: originalBuffer,
      fileName: file.name,
      rowErrors: [],
    };
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return {
      ok: false,
      status: 400,
      errorCode: "UNSUPPORTED_FILE",
      error: "Formato no soportado. Usa un archivo .xlsx o .csv.",
      rowErrors: [],
    };
  }

  const cycle = normalizeAcademicOfferCycle(String(form.get("cycle") ?? ""));
  if (!cycle) return invalidCycle();

  return {
    ok: true,
    cycle,
    dryRun,
    input: { kind: "buffer", buffer: originalBuffer, fileName: file.name },
    checksumBuffer: originalBuffer,
    fileName: file.name,
    rowErrors: [],
  };
}

export async function resolveAcademicOfferRequestImport(
  request: Request,
): Promise<AcademicOfferControlInput> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return resolveAcademicOfferFormImport(await request.formData());
  }

  const payload = (await request.json().catch(() => null)) as AcademicOfferJsonPayload | null;
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      status: 400,
      errorCode: "INVALID_JSON",
      error: "El cuerpo JSON no es válido.",
      rowErrors: [],
    };
  }

  return resolveAcademicOfferJsonImport(payload);
}
