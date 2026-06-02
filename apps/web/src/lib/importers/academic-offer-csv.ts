import ExcelJS from "exceljs";

import { normalizeHeader, parseCsvText } from "@/lib/importers/csv-utils";

type CsvRecord = Record<string, string>;

export function isAcademicOfferCsvFileName(fileName: string) {
  return fileName.toLowerCase().endsWith(".csv");
}

function pick(row: CsvRecord, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value?.trim()) return value.trim();
  }
  return "";
}

function yes(value: string) {
  return ["1", "si", "true", "verdadero", "x", "activo", "activa"].includes(normalizeHeader(value));
}

function isInactive(row: CsvRecord) {
  const value = pick(row, ["activo", "activa", "active", "is_active", "visible"]);
  if (!value) return false;
  return !yes(value);
}

function isOnline(row: CsvRecord) {
  const campus = normalizeHeader(pick(row, ["plantel", "campus", "sede"]));
  const modality = normalizeHeader(pick(row, ["modalidad", "delivery", "tipo", "formato"]));
  return campus === "online" || modality.includes("online");
}

function isPostgraduate(row: CsvRecord) {
  const level = normalizeHeader(pick(row, ["nivel", "linea", "linea de negocio", "categoria"]));
  const program = normalizeHeader(pick(row, ["programa", "carrera", "plan de estudios"]));
  return level.includes("posgrado") || program.includes("maestr");
}

export async function academicOfferCsvToXlsxBuffer(buffer: Buffer) {
  const rows = parseCsvText(buffer.toString("utf8"));
  if (rows.length < 2) {
    throw new Error("El CSV de oferta académica debe incluir encabezados y al menos una fila de datos.");
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  const records = rows.slice(1).map((cells) => {
    const record: CsvRecord = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });

  const workbook = new ExcelJS.Workbook();
  const onlineSheet = workbook.addWorksheet("Online");
  onlineSheet.addRow(["Licenciatura", "Posgrado", "Planes Licenciatura", "Planes Posgrado"]);

  const plantelesSheet = workbook.addWorksheet("Planteles");
  plantelesSheet.addRow([
    "Plantel",
    "Programa",
    "Escolarizado",
    "Ejecutivo",
    "Horario Escolarizado",
    "Horario Ejecutivo",
    "Planes",
    "Modulo",
    "Materias por Modulo",
  ]);

  for (const row of records) {
    const program = pick(row, ["programa", "carrera", "plan de estudios", "oferta"]);
    if (!program) continue;
    if (isInactive(row)) continue;

    const plans = pick(row, ["planes", "plan", "cuatrimestres", "cuatrimestre", "duracion"]);
    const academicModule = pick(row, ["modulo", "módulo", "module"]) || "Longitudinal";
    const subjectsByModule = pick(row, [
      "materias_por_modulo",
      "materias por modulo",
      "materias por módulo",
      "notas",
    ]);
    if (isOnline(row)) {
      if (isPostgraduate(row)) onlineSheet.addRow(["", program, "", plans]);
      else onlineSheet.addRow([program, "", plans, ""]);
      continue;
    }

    const campus = pick(row, ["plantel", "campus", "sede"]);
    if (!campus) continue;

    const modality = normalizeHeader(pick(row, ["modalidad", "delivery", "tipo", "formato"]));
    const escolarizadoRaw = pick(row, ["escolarizado", "escolarizada", "presencial"]);
    const ejecutivoRaw = pick(row, ["ejecutivo", "ejecutiva"]);
    const commonSchedule = pick(row, ["horario", "horarios", "schedule"]);
    const escolarizado =
      yes(escolarizadoRaw) ||
      (!ejecutivoRaw &&
        (modality.includes("escolar") ||
          modality.includes("presencial") ||
          modality.includes("mixt") ||
          !modality));
    const ejecutivo =
      yes(ejecutivoRaw) || modality.includes("ejecut") || modality.includes("mixt");

    plantelesSheet.addRow([
      campus,
      program,
      escolarizado ? "SI" : "",
      ejecutivo ? "SI" : "",
      pick(row, ["horario escolarizado", "horario escolarizada", "hor escolarizado"]) ||
        (escolarizado ? commonSchedule : ""),
      pick(row, ["horario ejecutivo", "hor ejecutivo"]) ||
        (ejecutivo ? commonSchedule : ""),
      plans,
      academicModule,
      subjectsByModule,
    ]);
  }

  const generated = await workbook.xlsx.writeBuffer();
  return Buffer.from(generated);
}
