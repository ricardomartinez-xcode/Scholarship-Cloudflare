import { ImportValidationError } from "@relead/domain/import-export/import/errors";

export function assertImportHeaders(headers: string[], required: string[]) {
  const normalized = new Set(headers.map((h) => h.trim().toLowerCase()));
  const missing = required.filter((key) => !normalized.has(key.trim().toLowerCase()));
  if (missing.length) {
    throw new ImportValidationError(`Faltan encabezados requeridos: ${missing.join(", ")}`);
  }
}
