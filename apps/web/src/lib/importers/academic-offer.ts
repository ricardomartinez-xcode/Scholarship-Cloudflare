import fs from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import { CampusKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeKey } from "@/lib/text-normalize";
import {
  addConfiguredCampusAliasesToLookup,
  canonicalImportKey,
  loadImporterAliasRows,
  type ImporterAliasOptions,
} from "@/lib/importers/configured-aliases";
import {
  normalizeBusinessLineWithAliases,
  type CanonicalBusinessLine,
} from "@/lib/pricing-normalize";
import { normalizeAcademicPricingPlans } from "@/lib/academic-offer-plans";
import {
  academicModuleOrBlank,
  type AcademicModuleSelection,
} from "@/lib/academic-modules";
import { listProgramOfferingModuleMetaById } from "@/lib/program-offering-subjects";
import {
  EXCEL_SHEETS_OMIT,
  type AcademicOfferCycle,
} from "@/config/academicOffer";

type ParsedRow = {
  programName: string;
  programNormalized: string;
  level: string | null;
  lineOfBusiness: CanonicalBusinessLine | null;
  escolarizado: boolean;
  ejecutivo: boolean;
  escolarizadoSchedule: string | null;
  ejecutivoSchedule: string | null;
  delivery: "CAMPUS" | "ONLINE";
  pricingPlans: number[] | null;
  module: AcademicModuleSelection;
  moduleCount: number | null;
  subjectsByModule: string | null;
};

type CampusParseResult = {
  campusId: string;
  campusCode: string;
  sheetName: string;
  /** Pretty campus name read from column A of the Planteles sheet (null for online-sheet) */
  campusNameFromExcel: string | null;
  rows: ParsedRow[];
  source: "campus-sheet" | "online-sheet";
};

type OnlineColumnMap = {
  licenciatura: number;
  posgrado: number;
  licenciaturaPlanes: number | null;
  posgradoPlanes: number | null;
};

type PlantelesColumnMap = {
  ciclo: number | null;
  plantel: number;
  programa: number;
  linea: number | null;
  modalidad: number | null;
  escolarizado: number | null;
  ejecutivo: number | null;
  horEscolarizado: number;
  horEjecutivo: number;
  planes: number | null;
  modulo: number | null;
  moduleCount: number | null;
  materiasPorModulo: number | null;
  estado: number | null;
};

type PlantelesEntry = {
  originalName: string;
  rows: ParsedRow[];
};

export type ImportAcademicOfferSummary = {
  ok: true;
  cycle: string;
  campusesProcessed: number;
  programs: { created: number; updated: number };
  offerings: {
    created: number;
    updated: number;
    reactivated: number;
    deactivated: number;
  };
  warnings: string[];
  detectedSheets: { online: string | null; planteles: string | null };
  detectedColumns: {
    online: { licenciatura: number; posgrado: number; licenciaturaPlanes: number | null; posgradoPlanes: number | null };
    planteles: {
      ciclo: number | null;
      plantel: number;
      programa: number;
      linea: number | null;
      modalidad: number | null;
      escolarizado: number | null;
      ejecutivo: number | null;
      horEscolarizado: number;
      horEjecutivo: number;
      planes: number | null;
      modulo: number | null;
      moduleCount: number | null;
      materiasPorModulo: number | null;
      estado: number | null;
    };
  } | null;
  perCampus: Array<{
    campusCode: string;
    campusName: string;
    sheetName: string;
    source: CampusParseResult["source"];
    rows: number;
    offeringsCreated: number;
    offeringsUpdated: number;
    offeringsReactivated: number;
    offeringsDeactivated: number;
  }>;
};

export type ImportAcademicOfferInput =
  | { kind: "buffer"; buffer: Uint8Array; fileName?: string }
  | { kind: "path"; filePath: string };

export type AcademicOfferPreviewRow = {
  id: string;
  campusCode: string;
  campusName: string;
  cycle: string;
  programName: string;
  line: string | null;
  modality: string;
  pricingPlans: number[];
  module: AcademicModuleSelection;
  moduleCount: number | null;
  subjectsByModule: string | null;
  isActive: boolean;
  hasPlanPdf: boolean;
  hasBrochurePdf: boolean;
};

export type PreparedAcademicOfferImportPayload = {
  cycle: AcademicOfferCycle;
  warnings: string[];
  detectedSheets: { online: string | null; planteles: string | null };
  detectedColumns: ImportAcademicOfferSummary["detectedColumns"];
  parsed: CampusParseResult[];
};

function isOmittedSheet(name: string): boolean {
  const nk = normalizeKey(name);
  if (nk.includes(" vs ")) return true;
  return EXCEL_SHEETS_OMIT.some((s) => normalizeKey(s) === nk);
}

function cellToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "VERDADERO" : "";
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    const v = value as {
      text?: string;
      richText?: Array<{ text?: string }>;
      formula?: string;
      result?: unknown;
      hyperlink?: string;
    };
    if (typeof v.text === "string") return v.text;
    if (Array.isArray(v.richText)) {
      return v.richText.map((part) => part.text ?? "").join("");
    }
    if (typeof v.formula === "string" && v.result != null) return String(v.result);
    if (typeof v.hyperlink === "string") return v.text || v.hyperlink;
  }

  return String(value);
}

function cellTruthy(value: unknown): boolean {
  if (value === true) return true;
  if (value === 1) return true;
  const t = normalizeKey(cellToText(value));
  return t === "verdadero" || t === "true" || t === "1" || t === "si" || t === "sí";
}

function cellExplicitlyInactive(value: unknown): boolean {
  const t = normalizeKey(cellToText(value));
  if (!t) return false;
  return (
    t === "false" ||
    t === "0" ||
    t === "no" ||
    t === "inactivo" ||
    t === "inactiva" ||
    t === "inactive" ||
    t === "baja"
  );
}

function cleanText(value: unknown): string {
  return cellToText(value).replace(/\s+/g, " ").trim();
}

function parseModuleCount(value: unknown): number | null {
  const text = cleanText(value);
  if (!text) return null;
  const match = text.match(/\d+/);
  if (!match) return null;
  const count = Number(match[0]);
  return Number.isInteger(count) && count > 0 ? count : null;
}

/**
 * Auto-detect the Online sheet from available worksheets.
 * Strategy (in order):
 *  1. Name normalizes to "online"
 *  2. Name contains "online"
 *  3. First-row headers match Licenciatura + Posgrado pattern
 */
function detectOnlineSheet(sheets: ExcelJS.Worksheet[]): ExcelJS.Worksheet | null {
  const exact = sheets.find((ws) => normalizeKey(ws.name) === "online");
  if (exact) return exact;

  const byName = sheets.find((ws) => normalizeKey(ws.name).includes("online"));
  if (byName) return byName;

  // Detect by first-row header content
  for (const ws of sheets) {
    const hRow = ws.getRow(1);
    const h1 = normalizeKey(cleanText(hRow.getCell(1).value));
    const h2 = normalizeKey(cleanText(hRow.getCell(2).value));
    if (
      (h1.includes("licenciatura") || h2.includes("licenciatura")) &&
      (h1.includes("posgrado") || h2.includes("posgrado"))
    ) {
      return ws;
    }
  }
  return null;
}

/**
 * Auto-detect the Planteles sheet from available worksheets.
 * Strategy (in order):
 *  1. Name normalizes to "planteles"
 *  2. Name contains "plantel"
 *  3. First-row headers match Plantel + Programa pattern
 */
function detectPlantelesSheet(
  sheets: ExcelJS.Worksheet[],
  exclude: ExcelJS.Worksheet | null
): ExcelJS.Worksheet | null {
  const candidates = exclude ? sheets.filter((ws) => ws !== exclude) : sheets;

  const exact = candidates.find((ws) => normalizeKey(ws.name) === "planteles");
  if (exact) return exact;

  const byName = candidates.find((ws) => normalizeKey(ws.name).includes("plantel"));
  if (byName) return byName;

  // Detect by first-row header content
  for (const ws of candidates) {
    const hRow = ws.getRow(1);
    const headers = Array.from({ length: 12 }, (_, index) =>
      normalizeKey(cleanText(hRow.getCell(index + 1).value)),
    );
    const hasCampus = headers.some((header) =>
      header.includes("plantel") || header.includes("campus") || header.includes("sede"),
    );
    const hasProgram = headers.some((header) =>
      header.includes("programa") || header.includes("carrera"),
    );
    if (hasCampus && hasProgram) {
      return ws;
    }
  }
  return null;
}

/**
 * Detect 1-based column indices for the Online sheet by scanning the first row.
 * Defaults to A=Licenciatura, B=Posgrado if headers are not recognized.
 */
function detectOnlineColumns(ws: ExcelJS.Worksheet): OnlineColumnMap {
  const hRow = ws.getRow(1);
  let licenciaturaCol = 1;
  let posgradoCol = 2;
  let licenciaturaPlanesCol: number | null = null;
  let posgradoPlanesCol: number | null = null;

  // Only scan if the first row looks like headers (text cells)
  const firstCellText = normalizeKey(cleanText(hRow.getCell(1).value));
  const secondCellText = normalizeKey(cleanText(hRow.getCell(2).value));
  if (
    firstCellText.includes("licenciatura") ||
    firstCellText.includes("programa") ||
    secondCellText.includes("posgrado") ||
    secondCellText.includes("programa")
  ) {
    // Likely a header row — scan for known keywords
    for (let c = 1; c <= 10; c++) {
      const h = normalizeKey(cleanText(hRow.getCell(c).value));
      if (!h) continue;
      const isPlanColumn =
        h.includes("plan") ||
        h.includes("cuatri") ||
        h.includes("cuatrimestre") ||
        h.includes("duracion") ||
        h.includes("duración");
      if (isPlanColumn && h.includes("licenciatura")) {
        licenciaturaPlanesCol = c;
      } else if (isPlanColumn && h.includes("posgrado")) {
        posgradoPlanesCol = c;
      } else if (h.includes("licenciatura")) {
        licenciaturaCol = c;
      } else if (h.includes("posgrado")) {
        posgradoCol = c;
      }
    }
  }

  return {
    licenciatura: licenciaturaCol,
    posgrado: posgradoCol,
    licenciaturaPlanes: licenciaturaPlanesCol,
    posgradoPlanes: posgradoPlanesCol,
  };
}

/**
 * Detect 1-based column indices for the Planteles sheet by scanning the first row.
 * Defaults to A=plantel, B=programa, C=escolarizado, D=ejecutivo, E=horEscol, F=horEjec.
 */
function detectPlantelesColumns(ws: ExcelJS.Worksheet): PlantelesColumnMap {
  const hRow = ws.getRow(1);
  let cicloCol: number | null = null;
  let plantelCol = 1;
  let programaCol = 2;
  let lineaCol: number | null = null;
  let modalidadCol: number | null = null;
  let escolarizadoCol: number | null = 3;
  let ejecutivoCol: number | null = 4;
  let horEscolarizadoCol = 5;
  let horEjecutivoCol = 6;
  let planesCol: number | null = null;
  let moduloCol: number | null = null;
  let moduleCountCol: number | null = null;
  let materiasPorModuloCol: number | null = null;
  let estadoCol: number | null = null;

  // Only scan if first row looks like a header row (not data)
  const firstCellText = normalizeKey(cleanText(hRow.getCell(1).value));
  const secondCellText = normalizeKey(cleanText(hRow.getCell(2).value));
  // If both first cells look like known headers, try to map all columns
  const headerProbe = Array.from({ length: 12 }, (_, index) =>
    normalizeKey(cleanText(hRow.getCell(index + 1).value)),
  );
  const looksLikeHeader =
    firstCellText.includes("plantel") ||
    firstCellText.includes("campus") ||
    firstCellText.includes("sede") ||
    firstCellText === "ciclo" ||
    secondCellText.includes("programa") ||
    secondCellText.includes("carrera") ||
    headerProbe.some((header) =>
      header.includes("plantel") ||
      header.includes("campus") ||
      header.includes("sede") ||
      header.includes("programa") ||
      header.includes("carrera"),
    );

  if (looksLikeHeader) {
    escolarizadoCol = null;
    ejecutivoCol = null;
    for (let c = 1; c <= 16; c++) {
      const h = normalizeKey(cleanText(hRow.getCell(c).value));
      if (!h) continue;

      if (h === "ciclo" || h === "cycle") {
        cicloCol = c;
      } else if (h.includes("plantel") || h.includes("campus") || h.includes("sede")) {
        plantelCol = c;
      } else if (
        (h.includes("programa") || h.includes("carrera")) &&
        !h.includes("horario")
      ) {
        programaCol = c;
      } else if (
        h.includes("linea") ||
        h.includes("línea") ||
        h.includes("nivel") ||
        h.includes("business")
      ) {
        lineaCol = c;
      } else if (
        h.includes("modalidad") ||
        h.includes("delivery") ||
        h.includes("formato") ||
        h === "tipo"
      ) {
        modalidadCol = c;
      } else if (h.includes("escolariz") && !h.includes("horario")) {
        escolarizadoCol = c;
      } else if (h.includes("ejecutiv") && !h.includes("horario")) {
        ejecutivoCol = c;
      } else if (
        h.includes("horario") &&
        (h.includes("escolariz") || h.includes("escol"))
      ) {
        horEscolarizadoCol = c;
      } else if (
        h.includes("horario") &&
        (h.includes("ejecutiv") || h.includes("ejec"))
      ) {
        horEjecutivoCol = c;
      } else if (
        h.includes("plan") ||
        h.includes("cuatri") ||
        h.includes("cuatrimestre") ||
        h.includes("duracion") ||
        h.includes("duración")
      ) {
        planesCol = c;
      } else if (
        h.includes("no. de modulos") ||
        h.includes("no de modulos") ||
        h.includes("numero de modulos") ||
        h.includes("num modulos") ||
        h === "modulos" ||
        h === "módulos"
      ) {
        moduleCountCol = c;
      } else if (
        h.includes("materiaspor") ||
        (h.includes("materia") && (h.includes("modulo") || h.includes("módulo"))) ||
        h === "notas" ||
        h === "nota"
      ) {
        materiasPorModuloCol = c;
      } else if (h.includes("modulo") || h.includes("módulo")) {
        moduloCol = c;
      } else if (
        h === "estado" ||
        h === "status" ||
        h === "activo" ||
        h === "activa" ||
        h === "active" ||
        h === "visible"
      ) {
        estadoCol = c;
      }
    }
  }

  return {
    ciclo: cicloCol,
    plantel: plantelCol,
    programa: programaCol,
    linea: lineaCol,
    modalidad: modalidadCol,
    escolarizado: escolarizadoCol,
    ejecutivo: ejecutivoCol,
    horEscolarizado: horEscolarizadoCol,
    horEjecutivo: horEjecutivoCol,
    planes: planesCol,
    modulo: moduloCol,
    moduleCount: moduleCountCol,
    materiasPorModulo: materiasPorModuloCol,
    estado: estadoCol,
  };
}

function parseOnlineSheet(
  ws: ExcelJS.Worksheet,
  cols: OnlineColumnMap,
  aliasRows: Awaited<ReturnType<typeof loadImporterAliasRows>>,
): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let emptyStreak = 0;
  const maxRows = Math.max(ws.rowCount || 2, 2);

  for (let r = 2; r <= maxRows; r++) {
    const row = ws.getRow(r);
    const licenciatura = cleanText(row.getCell(cols.licenciatura).value);
    const posgrado = cleanText(row.getCell(cols.posgrado).value);
    const licenciaturaPlans = cols.licenciaturaPlanes
      ? normalizeAcademicPricingPlans(row.getCell(cols.licenciaturaPlanes).value)
      : null;
    const posgradoPlans = cols.posgradoPlanes
      ? normalizeAcademicPricingPlans(row.getCell(cols.posgradoPlanes).value)
      : null;

    if (!licenciatura && !posgrado) {
      emptyStreak += 1;
      if (emptyStreak >= 5) break;
      continue;
    }
    emptyStreak = 0;

    const entries = [
      { programName: licenciatura, level: "LICENCIATURA", pricingPlans: licenciaturaPlans },
      { programName: posgrado, level: "POSGRADO", pricingPlans: posgradoPlans },
    ];

    for (const entry of entries) {
      if (!entry.programName) continue;
      rows.push({
        programName: entry.programName,
        programNormalized: canonicalImportKey(aliasRows, "program", entry.programName) || normalizeKey(entry.programName),
        level: entry.level,
        lineOfBusiness: normalizeBusinessLineWithAliases(entry.level, aliasRows),
        escolarizado: false,
        ejecutivo: false,
        escolarizadoSchedule: null,
        ejecutivoSchedule: null,
        delivery: "ONLINE",
        pricingPlans: entry.pricingPlans,
        module: "Longitudinal",
        moduleCount: null,
        subjectsByModule: null,
      });
    }
  }

  const deduped = new Map<string, ParsedRow>();
  for (const row of rows) {
    if (!deduped.has(row.programNormalized)) deduped.set(row.programNormalized, row);
  }

  return Array.from(deduped.values());
}

function parsePlantelesSheet(
  ws: ExcelJS.Worksheet,
  cols: PlantelesColumnMap,
  aliasRows: Awaited<ReturnType<typeof loadImporterAliasRows>>,
): Map<string, PlantelesEntry> {
  const byCampus = new Map<string, { originalName: string; rows: Map<string, ParsedRow> }>();
  let emptyStreak = 0;
  const maxRows = Math.max(ws.rowCount || 2, 2);

  for (let r = 2; r <= maxRows; r++) {
    const row = ws.getRow(r);
    const campusName = cleanText(row.getCell(cols.plantel).value);
    const programName = cleanText(row.getCell(cols.programa).value);

    if (!campusName && !programName) {
      emptyStreak += 1;
      if (emptyStreak >= 5) break;
      continue;
    }
    emptyStreak = 0;
    if (!campusName || !programName) continue;
    if (cols.estado && cellExplicitlyInactive(row.getCell(cols.estado).value)) {
      continue;
    }

    const campusKey = canonicalImportKey(aliasRows, "campus", campusName) || normalizeKey(campusName);
    const programNormalized = canonicalImportKey(aliasRows, "program", programName) || normalizeKey(programName);
    const lineRaw = cols.linea ? cleanText(row.getCell(cols.linea).value) : "";
    const lineOfBusiness = normalizeBusinessLineWithAliases(lineRaw, aliasRows);
    const modality = cols.modalidad
      ? normalizeKey(cleanText(row.getCell(cols.modalidad).value))
      : "";
    const campusLooksOnline = normalizeKey(campusName).includes("online");
    const delivery =
      campusLooksOnline || modality.includes("online") ? "ONLINE" : "CAMPUS";
    const pricingPlans = cols.planes
      ? normalizeAcademicPricingPlans(row.getCell(cols.planes).value)
      : null;
    const academicModule = academicModuleOrBlank(
      cols.modulo ? row.getCell(cols.modulo).value : null,
    );
    const moduleCount = cols.moduleCount
      ? parseModuleCount(row.getCell(cols.moduleCount).value)
      : null;
    const subjectsByModule =
      cols.materiasPorModulo ? cleanText(row.getCell(cols.materiasPorModulo).value) || null : null;
    const explicitEscolarizado = cols.escolarizado
      ? cellTruthy(row.getCell(cols.escolarizado).value)
      : false;
    const explicitEjecutivo = cols.ejecutivo
      ? cellTruthy(row.getCell(cols.ejecutivo).value)
      : false;
    const modalityEscolarizado =
      modality.includes("escolar") ||
      modality.includes("presencial") ||
      modality.includes("mixt");
    const modalityEjecutivo =
      modality.includes("ejecut") ||
      modality.includes("mixt");
    const next: ParsedRow = {
      programName,
      programNormalized,
      level: lineRaw || null,
      lineOfBusiness,
      escolarizado:
        delivery === "ONLINE" ? false : explicitEscolarizado || modalityEscolarizado,
      ejecutivo: delivery === "ONLINE" ? false : explicitEjecutivo || modalityEjecutivo,
      escolarizadoSchedule:
        delivery === "ONLINE" ? null : cleanText(row.getCell(cols.horEscolarizado).value) || null,
      ejecutivoSchedule:
        delivery === "ONLINE" ? null : cleanText(row.getCell(cols.horEjecutivo).value) || null,
      delivery,
      pricingPlans,
      module: academicModule,
      moduleCount,
      subjectsByModule,
    };

    const campusEntry = byCampus.get(campusKey) ?? { originalName: campusName, rows: new Map<string, ParsedRow>() };
    const rowKey = `${programNormalized}|${academicModule}`;
    const prev = campusEntry.rows.get(rowKey);
    if (!prev) {
      campusEntry.rows.set(rowKey, next);
    } else {
      prev.escolarizado ||= next.escolarizado;
      prev.ejecutivo ||= next.ejecutivo;
      if (!prev.escolarizadoSchedule && next.escolarizadoSchedule) {
        prev.escolarizadoSchedule = next.escolarizadoSchedule;
      }
      if (!prev.ejecutivoSchedule && next.ejecutivoSchedule) {
        prev.ejecutivoSchedule = next.ejecutivoSchedule;
      }
      if (next.pricingPlans !== null) {
        prev.pricingPlans = Array.from(
          new Set([...(prev.pricingPlans ?? []), ...next.pricingPlans]),
        ).sort((left, right) => left - right);
      }
      if (!prev.subjectsByModule && next.subjectsByModule) {
        prev.subjectsByModule = next.subjectsByModule;
      }
      if (prev.moduleCount === null && next.moduleCount !== null) {
        prev.moduleCount = next.moduleCount;
      }
      if (!prev.lineOfBusiness && next.lineOfBusiness) {
        prev.lineOfBusiness = next.lineOfBusiness;
      }
      if (!prev.level && next.level) {
        prev.level = next.level;
      }
    }
    byCampus.set(campusKey, campusEntry);
  }

  const result = new Map<string, PlantelesEntry>();
  for (const [campusKey, campusEntry] of byCampus) {
    result.set(campusKey, {
      originalName: campusEntry.originalName,
      rows: Array.from(campusEntry.rows.values()),
    });
  }
  return result;
}

async function loadWorkbook(input: ImportAcademicOfferInput) {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties.fullCalcOnLoad = false;

  if (input.kind === "path") {
    await wb.xlsx.readFile(input.filePath);
    return wb;
  }
  const workbookBuffer = input.buffer as unknown as Parameters<
    typeof wb.xlsx.load
  >[0];
  await wb.xlsx.load(workbookBuffer);
  return wb;
}

export async function resolveDefaultOfferExcelPath(): Promise<string | null> {
  const repoRoot = process.cwd();
  const docsDir = path.join(repoRoot, "docs");
  try {
    const entries = await fs.readdir(docsDir, { withFileTypes: true });
    const xlsx = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".xlsx"))
      .map((e) => e.name);
    const preferred = xlsx.find((n) => normalizeKey(n).includes("oferta academica"));
    if (preferred) return path.join(docsDir, preferred);
    const anyOferta = xlsx.find((n) => normalizeKey(n).includes("oferta"));
    if (anyOferta) return path.join(docsDir, anyOferta);
    return null;
  } catch {
    return null;
  }
}

export async function importAcademicOfferFromExcel(params: {
  input: ImportAcademicOfferInput;
  updatedBy: string;
  cycle: AcademicOfferCycle;
  strict?: boolean;
} & ImporterAliasOptions): Promise<ImportAcademicOfferSummary> {
  const cycle = params.cycle;
  const warnings: string[] = [];
  const aliasRows = await loadImporterAliasRows(params);

  const campuses = await prisma.campus.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, metaKey: true, kind: true },
  });
  const campusByNormalizedKey = new Map<
    string,
    { id: string; code: string; name: string; metaKey: string; kind: CampusKind }
  >();
  for (const c of campuses) {
    campusByNormalizedKey.set(normalizeKey(c.metaKey), c);
    campusByNormalizedKey.set(normalizeKey(c.name), c);
    campusByNormalizedKey.set(normalizeKey(c.code), c);
  }
  addConfiguredCampusAliasesToLookup(campusByNormalizedKey, aliasRows);

  const wb = await loadWorkbook(params.input);
  const allSheetNames = wb.worksheets.map((ws) => ws.name).join(", ");
  const relevantSheets = wb.worksheets.filter((ws) => !isOmittedSheet(ws.name));

  const onlineSheet = detectOnlineSheet(relevantSheets);
  const plantelesSheet = detectPlantelesSheet(relevantSheets, onlineSheet);

  if (!onlineSheet) {
    throw new Error(
      `No se encontró la hoja de programas Online. ` +
        `Hojas en el archivo: [${allSheetNames}]. ` +
        `Nombra la hoja "Online" o asegúrate de que la primera fila tenga encabezados "Licenciatura" y "Posgrado".`
    );
  }
  if (!plantelesSheet) {
    throw new Error(
      `No se encontró la hoja de Planteles. ` +
        `Hojas en el archivo: [${allSheetNames}]. ` +
        `Nombra la hoja "Planteles" o asegúrate de que la primera fila tenga encabezados "Plantel" y "Programa".`
    );
  }

  const onlineCols = detectOnlineColumns(onlineSheet);
  const plantelesCols = detectPlantelesColumns(plantelesSheet);

  const parsed: CampusParseResult[] = [];
  const usedCampusIds = new Set<string>();

  const onlineCampus = campuses.find((c) => c.code === "ONLINE");
  if (!onlineCampus) {
    throw new Error('No existe Campus code="ONLINE" en la BD. Ejecuta seed de campus.');
  }

  const onlineRows = parseOnlineSheet(onlineSheet, onlineCols, aliasRows);
  const plantelesRows = parsePlantelesSheet(plantelesSheet, plantelesCols, aliasRows);
  const plantelesIncludeOnline = Array.from(plantelesRows.keys()).some(
    (campusKey) => campusByNormalizedKey.get(campusKey)?.code === "ONLINE",
  );
  if (onlineRows.length === 0 && !plantelesIncludeOnline) {
    warnings.push(
      `Hoja "${onlineSheet.name}" no produjo programas. Verifica que las columnas Licenciatura (${onlineCols.licenciatura}) y Posgrado (${onlineCols.posgrado}) tengan datos.`
    );
  }
  parsed.push({
    campusId: onlineCampus.id,
    campusCode: onlineCampus.code,
    sheetName: onlineSheet.name,
    campusNameFromExcel: null,
    rows: onlineRows,
    source: "online-sheet",
  });
  usedCampusIds.add(onlineCampus.id);

  const unknownCampusNames: string[] = [];

  for (const [campusKey, entry] of plantelesRows) {
    const campus = campusByNormalizedKey.get(campusKey);
    if (!campus) {
      unknownCampusNames.push(entry.originalName);
      continue; // Always skip unrecognized campuses with a warning
    }
    parsed.push({
      campusId: campus.id,
      campusCode: campus.code,
      sheetName: plantelesSheet.name,
      campusNameFromExcel: entry.originalName,
      rows: entry.rows,
      source: "campus-sheet",
    });
    usedCampusIds.add(campus.id);
  }

  if (unknownCampusNames.length > 0) {
    warnings.push(
      `Planteles no reconocidos en BD (se omitieron): ${unknownCampusNames.join(", ")}`
    );
  }

  const missingCampuses = campuses.filter((c) => !usedCampusIds.has(c.id));
  if (missingCampuses.length > 0) {
    warnings.push(
      `Campus activos no cubiertos por el Excel (quedan sin cambios): ${missingCampuses.map((c) => c.code).join(", ")}`
    );
  }

  const summary: ImportAcademicOfferSummary = {
    ok: true,
    cycle,
    campusesProcessed: 0,
    programs: { created: 0, updated: 0 },
    offerings: { created: 0, updated: 0, reactivated: 0, deactivated: 0 },
    warnings,
    detectedSheets: {
      online: onlineSheet.name,
      planteles: plantelesSheet.name,
    },
    detectedColumns: {
      online: onlineCols,
      planteles: plantelesCols,
    },
    perCampus: [],
  };


  // === FASE 1: Program upserts outside transaction to avoid tx timeout ===
  const uniquePrograms = new Map<
    string,
    { name: string; level: string | null; lineOfBusiness: CanonicalBusinessLine | null }
  >();
  for (const campusRes of parsed) {
    for (const row of campusRes.rows) {
      if (!uniquePrograms.has(row.programNormalized)) {
        uniquePrograms.set(row.programNormalized, {
          name: row.programName,
          level: row.level,
          lineOfBusiness: row.lineOfBusiness,
        });
      }
    }
  }

  const programIdMap = new Map<string, string>();
  for (const [nameNormalized, prog] of uniquePrograms) {
    const existing = await prisma.program.findUnique({
      where: { nameNormalized },
      select: { id: true, name: true, level: true, businessLine: true },
    });
    if (!existing) {
      const created = await prisma.program.create({
        data: {
          name: prog.name,
          nameNormalized,
          level: prog.level,
          businessLine: prog.lineOfBusiness,
        },
        select: { id: true },
      });
      programIdMap.set(nameNormalized, created.id);
      summary.programs.created += 1;
    } else {
      const nextName = prog.name;
      const nextLevel = prog.level ?? existing.level;
      const nextBusinessLine = prog.lineOfBusiness ?? existing.businessLine;
      if (
        existing.name !== nextName ||
        existing.level !== nextLevel ||
        existing.businessLine !== nextBusinessLine
      ) {
        await prisma.program.update({
          where: { id: existing.id },
          data: { name: nextName, level: nextLevel, businessLine: nextBusinessLine },
        });
        summary.programs.updated += 1;
      }
      programIdMap.set(nameNormalized, existing.id);
    }
  }

  // === FASE 2: Transaction for campus + offerings ===
  await prisma.$transaction(async (tx) => {
    for (const campusRes of parsed) {
      // For campus-sheet entries, update the campus name with the pretty Excel value.
      // Never rename based on the sheet name itself (would set all to "Planteles").
      if (campusRes.source === "campus-sheet" && campusRes.campusNameFromExcel) {
        await tx.campus.update({
          where: { id: campusRes.campusId },
          data: { name: campusRes.campusNameFromExcel },
        });
      }

      const existingOfferings = await tx.programOffering.findMany({
        where: { campusId: campusRes.campusId, cycle },
        select: { programId: true, track: true, isActive: true },
      });
      const existingByProgramId = new Map(
        existingOfferings.map((o) => [`${o.programId}|${academicModuleOrBlank(o.track)}`, o.isActive])
      );

      const excelOfferingKeys: Array<{ programId: string; track: AcademicModuleSelection }> = [];
      let offeringsCreated = 0;
      let offeringsUpdated = 0;
      let offeringsReactivated = 0;

      for (const row of campusRes.rows) {
        const programId = programIdMap.get(row.programNormalized);
        if (!programId) continue;
        excelOfferingKeys.push({ programId, track: row.module });

        const prevIsActive = existingByProgramId.get(`${programId}|${row.module}`) ?? null;
        const where = {
          campusId_programId_cycle_track: {
            campusId: campusRes.campusId,
            programId,
            cycle,
            track: row.module,
          },
        };

        await tx.programOffering.upsert({
          where,
          update: {
            delivery: row.delivery,
            escolarizado: row.escolarizado,
            ejecutivo: row.ejecutivo,
            escolarizadoSchedule: row.escolarizadoSchedule,
            ejecutivoSchedule: row.ejecutivoSchedule,
            lineOfBusiness: row.lineOfBusiness,
            track: row.module,
            ...(row.pricingPlans !== null ? { pricingPlans: row.pricingPlans } : {}),
            moduleCount: row.moduleCount,
            subjectsByModule: row.subjectsByModule,
            isActive: true,
            archivedAt: null,
            archivedReason: null,
            updatedBy: params.updatedBy,
          },
          create: {
            campusId: campusRes.campusId,
            programId,
            cycle,
            delivery: row.delivery,
            escolarizado: row.escolarizado,
            ejecutivo: row.ejecutivo,
            escolarizadoSchedule: row.escolarizadoSchedule,
            ejecutivoSchedule: row.ejecutivoSchedule,
            lineOfBusiness: row.lineOfBusiness,
            pricingPlans: row.pricingPlans ?? [],
            moduleCount: row.moduleCount,
            subjectsByModule: row.subjectsByModule,
            track: row.module,
            isActive: true,
            archivedAt: null,
            archivedReason: null,
            updatedBy: params.updatedBy,
          },
          select: { id: true },
        });

        if (prevIsActive === null) {
          offeringsCreated += 1;
        } else if (!prevIsActive) {
          offeringsReactivated += 1;
        } else {
          offeringsUpdated += 1;
        }
      }

      const deactivated = await tx.programOffering.updateMany({
        where: {
          campusId: campusRes.campusId,
          cycle,
          isActive: true,
          ...(excelOfferingKeys.length
            ? {
                NOT: {
                  OR: excelOfferingKeys.map((item) => ({
                    programId: item.programId,
                    track: item.track,
                  })),
                },
              }
            : {}),
        },
        data: {
          isActive: false,
          archivedAt: new Date(),
          archivedReason: "NOT_IN_EXCEL",
          updatedBy: params.updatedBy,
        },
      });

      const offeringsDeactivated = deactivated.count;

      summary.campusesProcessed += 1;
      summary.offerings.created += offeringsCreated;
      summary.offerings.updated += offeringsUpdated;
      summary.offerings.reactivated += offeringsReactivated;
      summary.offerings.deactivated += offeringsDeactivated;

      summary.perCampus.push({
        campusCode: campusRes.campusCode,
        campusName: campusRes.campusNameFromExcel ?? campusRes.campusCode,
        sheetName: campusRes.sheetName,
        source: campusRes.source,
        rows: campusRes.rows.length,
        offeringsCreated,
        offeringsUpdated,
        offeringsReactivated,
        offeringsDeactivated,
      });
    }
  });

  return summary;
}

function getPreviewModalityLabel(row: ParsedRow) {
  if (row.delivery === "ONLINE") return "Online";
  if (row.escolarizado && row.ejecutivo) return "Escolarizado / Ejecutivo";
  if (row.ejecutivo) return "Ejecutivo";
  if (row.escolarizado) return "Escolarizado";
  return "Presencial";
}

function inferPreviewBusinessLine(
  row: ParsedRow,
  aliasRows: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  const configured = normalizeBusinessLineWithAliases(row.level, aliasRows);
  if (configured) return configured;

  const level = normalizeKey(row.level ?? "");
  if (level.includes("posgrado")) return "posgrado";
  if (level.includes("prepa") || level.includes("bachiller")) return "prepa";
  return "licenciatura";
}

export async function prepareAcademicOfferImport(params: {
  input: ImportAcademicOfferInput;
  cycle: AcademicOfferCycle;
} & ImporterAliasOptions): Promise<{
  summary: ImportAcademicOfferSummary;
  previewRows: AcademicOfferPreviewRow[];
  payload: PreparedAcademicOfferImportPayload;
}> {
  const cycle = params.cycle;
  const warnings: string[] = [];
  const aliasRows = await loadImporterAliasRows(params);

  const campuses = await prisma.campus.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, metaKey: true, kind: true },
  });
  const campusByNormalizedKey = new Map<
    string,
    { id: string; code: string; name: string; metaKey: string; kind: CampusKind }
  >();
  for (const campus of campuses) {
    campusByNormalizedKey.set(normalizeKey(campus.metaKey), campus);
    campusByNormalizedKey.set(normalizeKey(campus.name), campus);
    campusByNormalizedKey.set(normalizeKey(campus.code), campus);
  }
  addConfiguredCampusAliasesToLookup(campusByNormalizedKey, aliasRows);

  const workbook = await loadWorkbook(params.input);
  const allSheetNames = workbook.worksheets.map((worksheet) => worksheet.name).join(", ");
  const relevantSheets = workbook.worksheets.filter((worksheet) => !isOmittedSheet(worksheet.name));

  const onlineSheet = detectOnlineSheet(relevantSheets);
  const plantelesSheet = detectPlantelesSheet(relevantSheets, onlineSheet);

  if (!onlineSheet) {
    throw new Error(
      `No se encontró la hoja de programas Online. Hojas en el archivo: [${allSheetNames}].`,
    );
  }
  if (!plantelesSheet) {
    throw new Error(
      `No se encontró la hoja de Planteles. Hojas en el archivo: [${allSheetNames}].`,
    );
  }

  const onlineCols = detectOnlineColumns(onlineSheet);
  const plantelesCols = detectPlantelesColumns(plantelesSheet);

  const parsed: CampusParseResult[] = [];
  const usedCampusIds = new Set<string>();

  const onlineCampus = campuses.find((campus) => campus.code === "ONLINE");
  if (!onlineCampus) {
    throw new Error('No existe Campus code="ONLINE" en la BD. Ejecuta seed de campus.');
  }

  const onlineRows = parseOnlineSheet(onlineSheet, onlineCols, aliasRows);
  const plantelesRows = parsePlantelesSheet(plantelesSheet, plantelesCols, aliasRows);
  const plantelesIncludeOnline = Array.from(plantelesRows.keys()).some(
    (campusKey) => campusByNormalizedKey.get(campusKey)?.code === "ONLINE",
  );
  if (onlineRows.length === 0 && !plantelesIncludeOnline) {
    warnings.push(
      `Hoja "${onlineSheet.name}" no produjo programas. Verifica que las columnas Licenciatura y Posgrado tengan datos.`,
    );
  }
  parsed.push({
    campusId: onlineCampus.id,
    campusCode: onlineCampus.code,
    sheetName: onlineSheet.name,
    campusNameFromExcel: null,
    rows: onlineRows,
    source: "online-sheet",
  });
  usedCampusIds.add(onlineCampus.id);

  const unknownCampusNames: string[] = [];

  for (const [campusKey, entry] of plantelesRows) {
    const campus = campusByNormalizedKey.get(campusKey);
    if (!campus) {
      unknownCampusNames.push(entry.originalName);
      continue;
    }
    parsed.push({
      campusId: campus.id,
      campusCode: campus.code,
      sheetName: plantelesSheet.name,
      campusNameFromExcel: entry.originalName,
      rows: entry.rows,
      source: "campus-sheet",
    });
    usedCampusIds.add(campus.id);
  }

  if (unknownCampusNames.length > 0) {
    warnings.push(
      `Planteles no reconocidos en BD (se omitieron): ${unknownCampusNames.join(", ")}`,
    );
  }

  const missingCampuses = campuses.filter((campus) => !usedCampusIds.has(campus.id));
  if (missingCampuses.length > 0) {
    warnings.push(
      `Campus activos no cubiertos por el Excel (quedan sin cambios): ${missingCampuses
        .map((campus) => campus.code)
        .join(", ")}`,
    );
  }

  const summary: ImportAcademicOfferSummary = {
    ok: true,
    cycle,
    campusesProcessed: parsed.length,
    programs: { created: 0, updated: 0 },
    offerings: { created: 0, updated: 0, reactivated: 0, deactivated: 0 },
    warnings,
    detectedSheets: {
      online: onlineSheet.name,
      planteles: plantelesSheet.name,
    },
    detectedColumns: {
      online: onlineCols,
      planteles: plantelesCols,
    },
    perCampus: [],
  };

  const uniquePrograms = new Map<
    string,
    { name: string; level: string | null; lineOfBusiness: CanonicalBusinessLine | null }
  >();
  for (const campusRes of parsed) {
    for (const row of campusRes.rows) {
      if (!uniquePrograms.has(row.programNormalized)) {
        uniquePrograms.set(row.programNormalized, {
          name: row.programName,
          level: row.level,
          lineOfBusiness: row.lineOfBusiness,
        });
      }
    }
  }

  const existingPrograms = await prisma.program.findMany({
    where: {
      nameNormalized: { in: Array.from(uniquePrograms.keys()) },
    },
    select: {
      id: true,
      name: true,
      nameNormalized: true,
      level: true,
      businessLine: true,
      planPdfUrl: true,
      brochurePdfUrl: true,
      planDriveLink: true,
      planUrl: true,
    },
  });
  const existingProgramByNormalized = new Map(
    existingPrograms.map((program) => [program.nameNormalized, program]),
  );

  for (const [nameNormalized, program] of uniquePrograms) {
    const existing = existingProgramByNormalized.get(nameNormalized);
    if (!existing) {
      summary.programs.created += 1;
      continue;
    }
    const nextLevel = program.level ?? existing.level;
    const nextBusinessLine = program.lineOfBusiness ?? existing.businessLine;
    if (
      existing.name !== program.name ||
      existing.level !== nextLevel ||
      existing.businessLine !== nextBusinessLine
    ) {
      summary.programs.updated += 1;
    }
  }

  const existingOfferings = await prisma.programOffering.findMany({
    where: {
      cycle,
      campusId: { in: Array.from(new Set(parsed.map((campus) => campus.campusId))) },
    },
    select: {
      id: true,
      campusId: true,
      track: true,
      isActive: true,
      pricingPlans: true,
      program: {
        select: { nameNormalized: true },
      },
    },
  });

  const offeringsByCampus = new Map<
    string,
    Array<{
      nameNormalized: string;
      module: AcademicModuleSelection;
      isActive: boolean;
      pricingPlans: number[];
      moduleCount: number | null;
      subjectsByModule: string | null;
    }>
  >();
  const moduleMetaByOfferingId = await listProgramOfferingModuleMetaById(
    existingOfferings.map((offering) => offering.id),
  );
  for (const offering of existingOfferings) {
    const moduleMeta = moduleMetaByOfferingId.get(offering.id);
    const rows = offeringsByCampus.get(offering.campusId) ?? [];
    rows.push({
      nameNormalized: offering.program.nameNormalized,
      module: academicModuleOrBlank(offering.track),
      isActive: offering.isActive,
      pricingPlans: offering.pricingPlans ?? [],
      moduleCount: moduleMeta?.moduleCount ?? null,
      subjectsByModule: moduleMeta?.subjectsByModule ?? null,
    });
    offeringsByCampus.set(offering.campusId, rows);
  }

  const previewRows: AcademicOfferPreviewRow[] = [];
  for (const campusRes of parsed) {
    const existingByProgram = new Map(
      (offeringsByCampus.get(campusRes.campusId) ?? []).map((offering) => [
        `${offering.nameNormalized}|${offering.module}`,
        offering.isActive,
      ]),
    );
    const excelOfferingKeys = new Set<string>();
    let offeringsCreated = 0;
    let offeringsUpdated = 0;
    let offeringsReactivated = 0;

    for (const row of campusRes.rows) {
      const rowKey = `${row.programNormalized}|${row.module}`;
      excelOfferingKeys.add(rowKey);
      const previous = existingByProgram.get(rowKey);
      const existingOffering = (offeringsByCampus.get(campusRes.campusId) ?? []).find(
        (offering) =>
          offering.nameNormalized === row.programNormalized &&
          offering.module === row.module,
      );
      if (previous === undefined) {
        offeringsCreated += 1;
      } else if (!previous) {
        offeringsReactivated += 1;
      } else {
        offeringsUpdated += 1;
      }

      if (previewRows.length < 400) {
        const program = existingProgramByNormalized.get(row.programNormalized);
        previewRows.push({
          id: `${campusRes.campusId}:${row.programNormalized}:${row.module}`,
          campusCode: campusRes.campusCode,
          campusName: campusRes.campusNameFromExcel ?? campusRes.campusCode,
          cycle,
          programName: row.programName,
          line: program?.businessLine ?? row.lineOfBusiness ?? inferPreviewBusinessLine(row, aliasRows),
          modality: getPreviewModalityLabel(row),
          pricingPlans: row.pricingPlans ?? existingOffering?.pricingPlans ?? [],
          module: row.module,
          moduleCount: row.moduleCount ?? existingOffering?.moduleCount ?? null,
          subjectsByModule: row.subjectsByModule ?? existingOffering?.subjectsByModule ?? null,
          isActive: true,
          hasPlanPdf: Boolean(program?.planPdfUrl ?? program?.planDriveLink ?? program?.planUrl),
          hasBrochurePdf: Boolean(program?.brochurePdfUrl),
        });
      }
    }

    const offeringsDeactivated = (offeringsByCampus.get(campusRes.campusId) ?? []).filter(
      (offering) =>
        offering.isActive &&
        !excelOfferingKeys.has(`${offering.nameNormalized}|${offering.module}`),
    ).length;

    summary.offerings.created += offeringsCreated;
    summary.offerings.updated += offeringsUpdated;
    summary.offerings.reactivated += offeringsReactivated;
    summary.offerings.deactivated += offeringsDeactivated;
    summary.perCampus.push({
      campusCode: campusRes.campusCode,
      campusName: campusRes.campusNameFromExcel ?? campusRes.campusCode,
      sheetName: campusRes.sheetName,
      source: campusRes.source,
      rows: campusRes.rows.length,
      offeringsCreated,
      offeringsUpdated,
      offeringsReactivated,
      offeringsDeactivated,
    });
  }

  return {
    summary,
    previewRows,
    payload: {
      cycle,
      warnings,
      detectedSheets: summary.detectedSheets,
      detectedColumns: summary.detectedColumns,
      parsed,
    },
  };
}

export async function applyPreparedAcademicOfferImport(params: {
  payload: PreparedAcademicOfferImportPayload;
  updatedBy: string;
}): Promise<ImportAcademicOfferSummary> {
  const summary: ImportAcademicOfferSummary = {
    ok: true,
    cycle: params.payload.cycle,
    campusesProcessed: 0,
    programs: { created: 0, updated: 0 },
    offerings: { created: 0, updated: 0, reactivated: 0, deactivated: 0 },
    warnings: [...params.payload.warnings],
    detectedSheets: params.payload.detectedSheets,
    detectedColumns: params.payload.detectedColumns,
    perCampus: [],
  };

  const uniquePrograms = new Map<
    string,
    { name: string; level: string | null; lineOfBusiness: CanonicalBusinessLine | null }
  >();
  for (const campusRes of params.payload.parsed) {
    for (const row of campusRes.rows) {
      if (!uniquePrograms.has(row.programNormalized)) {
        uniquePrograms.set(row.programNormalized, {
          name: row.programName,
          level: row.level,
          lineOfBusiness: row.lineOfBusiness,
        });
      }
    }
  }

  const programIdMap = new Map<string, string>();
  for (const [nameNormalized, program] of uniquePrograms) {
    const existing = await prisma.program.findUnique({
      where: { nameNormalized },
      select: { id: true, name: true, level: true, businessLine: true },
    });
    if (!existing) {
      const created = await prisma.program.create({
        data: {
          name: program.name,
          nameNormalized,
          level: program.level,
          businessLine: program.lineOfBusiness,
        },
        select: { id: true },
      });
      programIdMap.set(nameNormalized, created.id);
      summary.programs.created += 1;
      continue;
    }

    const nextName = program.name;
    const nextLevel = program.level ?? existing.level;
    const nextBusinessLine = program.lineOfBusiness ?? existing.businessLine;
    if (
      existing.name !== nextName ||
      existing.level !== nextLevel ||
      existing.businessLine !== nextBusinessLine
    ) {
      await prisma.program.update({
        where: { id: existing.id },
        data: { name: nextName, level: nextLevel, businessLine: nextBusinessLine },
      });
      summary.programs.updated += 1;
    }
    programIdMap.set(nameNormalized, existing.id);
  }

  await prisma.$transaction(async (tx) => {
    for (const campusRes of params.payload.parsed) {
      if (campusRes.source === "campus-sheet" && campusRes.campusNameFromExcel) {
        await tx.campus.update({
          where: { id: campusRes.campusId },
          data: { name: campusRes.campusNameFromExcel },
        });
      }

      const existingOfferings = await tx.programOffering.findMany({
        where: { campusId: campusRes.campusId, cycle: params.payload.cycle },
        select: { programId: true, track: true, isActive: true },
      });
      const existingByProgramId = new Map(
        existingOfferings.map((offering) => [
          `${offering.programId}|${academicModuleOrBlank(offering.track)}`,
          offering.isActive,
        ]),
      );

      const excelOfferingKeys: Array<{ programId: string; track: AcademicModuleSelection }> = [];
      let offeringsCreated = 0;
      let offeringsUpdated = 0;
      let offeringsReactivated = 0;

      for (const row of campusRes.rows) {
        const programId = programIdMap.get(row.programNormalized);
        if (!programId) continue;
        excelOfferingKeys.push({ programId, track: row.module });

        const previous = existingByProgramId.get(`${programId}|${row.module}`) ?? null;
        await tx.programOffering.upsert({
          where: {
            campusId_programId_cycle_track: {
              campusId: campusRes.campusId,
              programId,
              cycle: params.payload.cycle,
              track: row.module,
            },
          },
          update: {
            delivery: row.delivery,
            escolarizado: row.escolarizado,
            ejecutivo: row.ejecutivo,
            escolarizadoSchedule: row.escolarizadoSchedule,
            ejecutivoSchedule: row.ejecutivoSchedule,
            lineOfBusiness: row.lineOfBusiness,
            track: row.module,
            ...(row.pricingPlans !== null ? { pricingPlans: row.pricingPlans } : {}),
            moduleCount: row.moduleCount,
            subjectsByModule: row.subjectsByModule,
            isActive: true,
            archivedAt: null,
            archivedReason: null,
            updatedBy: params.updatedBy,
          },
          create: {
            campusId: campusRes.campusId,
            programId,
            cycle: params.payload.cycle,
            delivery: row.delivery,
            escolarizado: row.escolarizado,
            ejecutivo: row.ejecutivo,
            escolarizadoSchedule: row.escolarizadoSchedule,
            ejecutivoSchedule: row.ejecutivoSchedule,
            lineOfBusiness: row.lineOfBusiness,
            pricingPlans: row.pricingPlans ?? [],
            moduleCount: row.moduleCount,
            subjectsByModule: row.subjectsByModule,
            track: row.module,
            isActive: true,
            archivedAt: null,
            archivedReason: null,
            updatedBy: params.updatedBy,
          },
        });

        if (previous === null) {
          offeringsCreated += 1;
        } else if (!previous) {
          offeringsReactivated += 1;
        } else {
          offeringsUpdated += 1;
        }
      }

      const deactivated = await tx.programOffering.updateMany({
        where: {
          campusId: campusRes.campusId,
          cycle: params.payload.cycle,
          isActive: true,
          ...(excelOfferingKeys.length
            ? {
                NOT: {
                  OR: excelOfferingKeys.map((item) => ({
                    programId: item.programId,
                    track: item.track,
                  })),
                },
              }
            : {}),
        },
        data: {
          isActive: false,
          archivedAt: new Date(),
          archivedReason: "NOT_IN_EXCEL",
          updatedBy: params.updatedBy,
        },
      });

      summary.campusesProcessed += 1;
      summary.offerings.created += offeringsCreated;
      summary.offerings.updated += offeringsUpdated;
      summary.offerings.reactivated += offeringsReactivated;
      summary.offerings.deactivated += deactivated.count;
      summary.perCampus.push({
        campusCode: campusRes.campusCode,
        campusName: campusRes.campusNameFromExcel ?? campusRes.campusCode,
        sheetName: campusRes.sheetName,
        source: campusRes.source,
        rows: campusRes.rows.length,
        offeringsCreated,
        offeringsUpdated,
        offeringsReactivated,
        offeringsDeactivated: deactivated.count,
      });
    }
  });

  return summary;
}
