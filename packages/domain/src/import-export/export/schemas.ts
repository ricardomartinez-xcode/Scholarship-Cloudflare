import type { ReportFilters } from "@relead/domain/import-export/export/types";
import { ExportValidationError } from "@relead/domain/import-export/export/errors";

export function validateReportFilters(filters: ReportFilters) {
  if (filters.dateFrom && Number.isNaN(Date.parse(filters.dateFrom))) {
    throw new ExportValidationError("dateFrom inválida");
  }
  if (filters.dateTo && Number.isNaN(Date.parse(filters.dateTo))) {
    throw new ExportValidationError("dateTo inválida");
  }
}
