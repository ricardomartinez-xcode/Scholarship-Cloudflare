import * as XLSX from "xlsx";

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
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
    const headers = json.length ? Object.keys(json[0]) : [];
    const rows = json.map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()])),
    );
    return { headers, rows };
  }
  throw new Error("Formato no soportado. Usa CSV o XLSX.");
}
