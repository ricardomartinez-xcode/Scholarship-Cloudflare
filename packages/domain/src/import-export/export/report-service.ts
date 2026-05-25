import { filterRows } from "@relead/domain/import-export/export/filters";
import { validateReportFilters } from "@relead/domain/import-export/export/schemas";
import { exportRowsToCsv } from "@relead/domain/import-export/export/csv-exporter";
import { exportRowsToXlsx } from "@relead/domain/import-export/export/xlsx-exporter";
import type { ReportFilters, ReportRow } from "@relead/domain/import-export/export/types";

export async function generateReportExport(rows: ReportRow[], filters: ReportFilters, format: "csv" | "xlsx") {
  validateReportFilters(filters);
  const filtered = filterRows(rows, filters);
  if (format === "csv") return { mime: "text/csv", body: exportRowsToCsv(filtered) };
  return {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: await exportRowsToXlsx(filtered),
  };
}
