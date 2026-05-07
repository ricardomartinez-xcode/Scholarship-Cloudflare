import type { ReportFilters, ReportRow } from "@relead/domain/import-export/export/types";

export function filterRows(rows: ReportRow[], filters: ReportFilters) {
  return rows.filter((row) => {
    if (filters.campus && row.campus !== filters.campus) return false;
    if (filters.modality && row.modality !== filters.modality) return false;
    if (filters.enrollmentType && row.enrollmentType !== filters.enrollmentType) return false;
    if (filters.status && row.status !== filters.status) return false;
    return true;
  });
}
