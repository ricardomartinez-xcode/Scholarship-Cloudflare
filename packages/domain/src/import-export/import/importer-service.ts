import { assertImportHeaders } from "@relead/domain/import-export/import/schemas";
import { normalizeRowKeys } from "@relead/domain/import-export/import/mapper";
import { parseImportFile } from "@relead/domain/import-export/import/parser";
import { buildImportSummary } from "@relead/domain/import-export/import/import-report";
import { validateImportRows } from "@relead/domain/import-export/import/validator";

export async function runImportPreview(file: File, requiredColumns: string[]) {
  const parsed = await parseImportFile(file);
  assertImportHeaders(parsed.headers, requiredColumns);
  const rows = parsed.rows.map(normalizeRowKeys);
  const errors = validateImportRows(rows, requiredColumns);

  return {
    rows,
    summary: buildImportSummary({
      rowsRead: rows.length,
      valid: rows.length - errors.length,
      invalid: errors.length,
      errors,
    }),
  };
}
