import ExcelJS from "exceljs";
import type { ReportRow } from "@relead/domain/import-export/export/types";

export async function exportRowsToXlsx(rows: ReportRow[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Reporte");
  const headers = rows.length ? Object.keys(rows[0]) : [];
  if (headers.length) {
    worksheet.addRow(headers);
    for (const row of rows) {
      worksheet.addRow(headers.map((header) => row[header as keyof ReportRow] ?? ""));
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
