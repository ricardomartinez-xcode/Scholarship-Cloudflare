import type { ImportRecord } from "@relead/domain/import-export/import/types";

export function normalizeRowKeys(row: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim().toLowerCase().replace(/\s+/g, "_"),
      value,
    ]),
  ) as ImportRecord;
}
