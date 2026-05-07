import type { ReportRow } from "@relead/domain/import-export/export/types";

export function exportRowsToCsv(rows: ReportRow[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const headerLine = headers.join(",");
  const lines = rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(","));
  return [headerLine, ...lines].join("\n");
}
