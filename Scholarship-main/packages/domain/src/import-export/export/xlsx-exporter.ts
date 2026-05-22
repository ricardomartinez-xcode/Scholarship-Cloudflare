import * as XLSX from "xlsx";
import type { ReportRow } from "@relead/domain/import-export/export/types";

export function exportRowsToXlsx(rows: ReportRow[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
