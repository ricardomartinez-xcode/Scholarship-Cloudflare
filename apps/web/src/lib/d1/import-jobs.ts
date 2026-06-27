import type { AppD1Database, JsonObject } from "./contracts";
import { newId, nowIso } from "./ids";
import { stringifyJson } from "./json";
import { D1DomainError } from "./errors";

export type ImportType =
  | "academic_offers"
  | "prices"
  | "benefits"
  | "base_scholarships"
  | "catalog"
  | "contacts"
  | "users"
  | "generic";

export interface CreateImportJobInput {
  organizationId?: string | null;
  importType: ImportType;
  idempotencyKey: string;
  requestedByUserId?: string | null;
  sourceFilename?: string | null;
  sourceR2Key?: string | null;
  sourceSha256?: string | null;
  options?: JsonObject;
  dryRun?: boolean;
}

interface ImportJobRow {
  id: string;
  status: string;
  dry_run: number;
}

export async function createImportJob(
  db: AppD1Database,
  input: CreateImportJobInput,
): Promise<ImportJobRow> {
  if (!input.idempotencyKey.trim()) {
    throw new D1DomainError("idempotencyKey is required", "validation_error", 400);
  }

  const id = newId("imp");
  const now = nowIso();

  await db
    .prepare(
      `INSERT OR IGNORE INTO import_job (
        id, organization_id, import_type, status, dry_run, idempotency_key,
        source_filename, source_r2_key, source_sha256, options_json,
        requested_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.organizationId ?? null,
      input.importType,
      input.dryRun === false ? 0 : 1,
      input.idempotencyKey.trim(),
      input.sourceFilename ?? null,
      input.sourceR2Key ?? null,
      input.sourceSha256 ?? null,
      stringifyJson(input.options),
      input.requestedByUserId ?? null,
      now,
      now,
    )
    .run();

  const job = await db
    .prepare(
      `SELECT id, status, dry_run
       FROM import_job
       WHERE idempotency_key = ?`,
    )
    .bind(input.idempotencyKey.trim())
    .first<ImportJobRow>();

  if (!job) {
    throw new D1DomainError("Import job could not be created", "import_job_missing", 500);
  }

  return job;
}

export async function recordImportIssue(
  db: AppD1Database,
  input: {
    importJobId: string;
    code: string;
    message: string;
    severity?: "warning" | "error";
    rowNumber?: number | null;
    columnName?: string | null;
    rawValue?: string | null;
  },
): Promise<string> {
  const id = newId("imissue");

  await db
    .prepare(
      `INSERT INTO import_issue (
        id, import_job_id, row_number, column_name, code, severity, message, raw_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.importJobId,
      input.rowNumber ?? null,
      input.columnName ?? null,
      input.code,
      input.severity ?? "error",
      input.message,
      input.rawValue ?? null,
    )
    .run();

  return id;
}
