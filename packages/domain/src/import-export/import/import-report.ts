import type { ImportSummary } from "@relead/domain/import-export/import/types";

export function buildImportSummary(input: Partial<ImportSummary>): ImportSummary {
  return {
    rowsRead: input.rowsRead ?? 0,
    valid: input.valid ?? 0,
    invalid: input.invalid ?? 0,
    inserted: input.inserted ?? 0,
    updated: input.updated ?? 0,
    skipped: input.skipped ?? 0,
    errors: input.errors ?? [],
  };
}
