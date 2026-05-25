import ExcelJS from "exceljs";

export function parseDelimited(text: string, delimiter = ",") {
  const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = (headerLine ?? "").split(delimiter).map((h) => h.trim());
  const rows = lines.map((line) => {
    const values = line.split(delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
  });
  return { headers, rows };
}

export async function parseImportFile(file: File) {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "csv") {
    const text = await file.text();
    return parseDelimited(text);
  }
  if (ext === "xlsx") {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);
    const firstSheet = workbook.worksheets[0];
    if (!firstSheet) return { headers: [], rows: [] };

    const rowsArray: string[][] = [];
    firstSheet.eachRow({ includeEmpty: false }, (row) => {
      const values: string[] = [];
      for (let index = 1; index <= firstSheet.columnCount; index += 1) {
        values.push(String(row.getCell(index).text ?? "").trim());
      }
      rowsArray.push(values);
    });

    const [headers = [], ...bodyRows] = rowsArray;
    const rows = bodyRows.map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""])),
    );
    return { headers, rows };
  }
  throw new Error("Formato no soportado. Usa CSV o XLSX.");
}
