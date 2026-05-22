import type { ImportRecord } from "@relead/domain/import-export/import/types";

export function validateImportRows(rows: ImportRecord[], requiredColumns: string[]) {
  const errors: Array<{ row: number; column: string; message: string }> = [];
  rows.forEach((row, index) => {
    for (const column of requiredColumns) {
      const value = row[column];
      if (value === null || value === undefined || String(value).trim() === "") {
        errors.push({ row: index + 2, column, message: "Valor requerido." });
      }
    }
  });
  return errors;
}
