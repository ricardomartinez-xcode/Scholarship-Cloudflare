import ExcelJS from "exceljs";

import { normalizeAcademicModuleDisplay } from "@/lib/academic-modules";
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
  const value = pick(row, [
    "estado",
    "activo",
    "activa",
    "active",
    "is_active",
    "visible",
  ]);
  if (!value) return false;
  return !yes(value);
}

function isOnline(row: CsvRecord, campus: string, modality: string) {
  const onlineRaw = pick(row, ["online", "en linea", "en línea", "virtual"]);
  const campusKey = normalizeHeader(campus);
  const modalityKey = normalizeHeader(modality);
  return yes(onlineRaw) || campusKey.includes("online") || modalityKey.includes("online");
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
    "Ciclo",
    "Plantel",
    "Programa",
    "Línea",
    "Modalidad",
    "Plan",
    "Modulo",
    "No. de modulos",
    "Horario escolarizado",
    "Horario ejecutivo",
    "Estado",
  ]);

  for (const row of records) {
    const program = pick(row, ["programa", "carrera", "plan de estudios", "oferta"]);
    if (!program) continue;
    if (isInactive(row)) continue;

    const plans = pick(row, ["planes", "plan", "cuatrimestres", "cuatrimestre", "duracion"]);
    const moduleRaw = pick(row, ["modulo", "módulo", "module"]);
    const academicModule = moduleRaw ? normalizeAcademicModuleDisplay(moduleRaw) : "";
    const numberOfModules = pick(row, [
      "no. de modulos",
      "no de modulos",
      "no. de módulos",
      "no de módulos",
      "numero de modulos",
      "número de módulos",
      "num modulos",
      "num módulos",
      "modulos",
      "módulos",
      "materias_por_modulo",
      "materias por modulo",
      "materias por módulo",
      "notas",
    ]);
    const campus = pick(row, ["plantel", "campus", "sede"]);
    if (!campus) continue;

    const modality = pick(row, ["modalidad", "delivery", "tipo", "formato"]);
    const modalityKey = normalizeHeader(modality);
    const commonSchedule = pick(row, ["horario", "horarios", "schedule"]);
    const escolarizadoRaw = pick(row, ["escolarizado", "escolarizada", "presencial"]);
    const ejecutivoRaw = pick(row, ["ejecutivo", "ejecutiva"]);
    const isOnlineProgram = isOnline(row, campus, modality);
    const escolarizado =
      !isOnlineProgram &&
      (yes(escolarizadoRaw) ||
        (!ejecutivoRaw &&
          (modalityKey.includes("escolar") ||
            modalityKey.includes("presencial") ||
            modalityKey.includes("mixt") ||
            !modalityKey)));
    const ejecutivo =
      !isOnlineProgram && (yes(ejecutivoRaw) || modalityKey.includes("ejecut") || modalityKey.includes("mixt"));
    const escolarizadoSchedule =
      pick(row, ["horario escolarizado", "horario escolarizada", "hor escolarizado"]) ||
      (escolarizado ? commonSchedule : "");
    const ejecutivoSchedule =
      pick(row, ["horario ejecutivo", "hor ejecutivo"]) ||
      (ejecutivo ? commonSchedule : "");

    plantelesSheet.addRow([
      pick(row, ["ciclo", "cycle"]),
      campus,
      program,
      pick(row, ["linea", "línea", "linea de negocio", "línea de negocio", "nivel"]),
      modality,
      plans,
      academicModule,
      numberOfModules,
      escolarizadoSchedule,
      ejecutivoSchedule,
      pick(row, ["estado", "activo", "activa", "active", "is_active", "visible"]) ||
        "Activo",
    ]);
  }

  const generated = await workbook.xlsx.writeBuffer();
  return Buffer.from(generated);
}
