import {
  ACADEMIC_OFFER_CYCLES,
  normalizeAcademicOfferCycle,
  type AcademicOfferCycle,
} from "@/config/academicOffer";
import { normalizeAcademicModule, parseAcademicModuleTokens } from "@/lib/academic-modules";
import { normalizeHeader, parseCsvText } from "@/lib/importers/csv-utils";

export type AdminPagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type NormalizedAcademicOfferRow = {
  row: number;
  values: Record<string, string>;
};

export type AcademicOfferRowError = {
  row: number;
  field: string;
  code: string;
  message: string;
};

const ACADEMIC_OFFER_HEADERS = [
  "Ciclo",
  "Plantel",
  "Programa",
  "Linea",
  "Modalidad",
  "Plan",
  "Modulo",
  "No. de modulos",
  "Horario escolarizado",
  "Horario ejecutivo",
  "Estado",
] as const;

const FIELD_ALIASES = {
  cycle: ["ciclo", "cycle"],
  campus: ["plantel", "campus", "sede"],
  program: ["programa", "carrera", "plan de estudios", "oferta"],
  modality: ["modalidad", "delivery", "tipo", "formato"],
  plan: ["planes", "plan", "cuatrimestres", "cuatrimestre", "duracion"],
  module: ["modulo", "module", "módulo"],
  line: ["linea", "línea", "linea de negocio", "línea de negocio", "nivel"],
  moduleCount: [
    "no. de modulos",
    "no de modulos",
    "no. de módulos",
    "no de módulos",
    "numero de modulos",
    "número de módulos",
    "num modulos",
    "num módulos",
    "materias por modulo",
    "materias por módulo",
  ],
  schoolSchedule: ["horario escolarizado", "horario escolarizada", "hor escolarizado"],
  executiveSchedule: ["horario ejecutivo", "hor ejecutivo"],
  status: ["estado", "activo", "activa", "active", "is_active", "visible"],
} as const;

const ALLOWED_PLANS = new Set([4, 9, 11]);
const ALLOWED_MODALITY_KEYS = new Set([
  "online",
  "enlinea",
  "virtual",
  "presencial",
  "escolarizado",
  "escolarizada",
  "mixta",
  "mixto",
  "ejecutivo",
  "ejecutiva",
]);

function toBoundedPositiveInt(value: string | null, fallback: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const integer = Math.trunc(numeric);
  if (integer < 1) return fallback;
  return Math.min(integer, max);
}

export function parseAdminPagination(
  searchParams: URLSearchParams,
  options?: { defaultPageSize?: number; maxPageSize?: number },
): AdminPagination {
  const maxPageSize = options?.maxPageSize ?? 100;
  const defaultPageSize = Math.min(options?.defaultPageSize ?? 50, maxPageSize);
  const page = toBoundedPositiveInt(searchParams.get("page"), 1, 10_000);
  const pageSize = toBoundedPositiveInt(
    searchParams.get("pageSize") ?? searchParams.get("limit"),
    defaultPageSize,
    maxPageSize,
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildEnvPresence(
  names: string[],
  env: Record<string, string | undefined> = process.env,
) {
  return names.map((name) => ({
    name,
    present: Boolean(env[name]?.trim()),
  }));
}

function normalizedAliasSet(aliases: readonly string[]) {
  return new Set(aliases.map((alias) => normalizeHeader(alias)));
}

function pickField(row: NormalizedAcademicOfferRow, aliases: readonly string[]) {
  const aliasSet = normalizedAliasSet(aliases);
  for (const [key, value] of Object.entries(row.values)) {
    if (aliasSet.has(key) && value.trim()) return value.trim();
  }
  return "";
}

function addRowError(
  rowErrors: AcademicOfferRowError[],
  row: number,
  field: string,
  code: string,
  message: string,
) {
  rowErrors.push({ row, field, code, message });
}

function normalizeRecord(record: Record<string, unknown>, row: number): NormalizedAcademicOfferRow {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeHeader(key);
    if (!normalizedKey) continue;
    values[normalizedKey] = String(value ?? "").trim();
  }
  return { row, values };
}

export function normalizeAcademicOfferRows(
  rows: Array<Record<string, unknown>>,
): NormalizedAcademicOfferRow[] {
  return rows.map((row, index) => normalizeRecord(row, index + 2));
}

export function parseAcademicOfferCsvRows(csvText: string): NormalizedAcademicOfferRow[] {
  const rows = parseCsvText(csvText);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => normalizeHeader(header));
  return rows.slice(1).map((cells, index) => {
    const values: Record<string, string> = {};
    headers.forEach((header, cellIndex) => {
      if (!header) return;
      values[header] = cells[cellIndex] ?? "";
    });
    return { row: index + 2, values };
  });
}

export function inferAcademicOfferCycle(
  rows: NormalizedAcademicOfferRow[],
  explicitCycle?: string | null,
): AcademicOfferCycle | null {
  const explicit = normalizeAcademicOfferCycle(explicitCycle);
  if (explicit) return explicit;

  const cycles = new Set<AcademicOfferCycle>();
  for (const row of rows) {
    const cycle = normalizeAcademicOfferCycle(pickField(row, FIELD_ALIASES.cycle));
    if (cycle) cycles.add(cycle);
  }
  return cycles.size === 1 ? Array.from(cycles)[0] : null;
}

function parsePlanNumbers(value: string) {
  return value
    .split(/[,;/|]+|\s+y\s+/i)
    .map((part) => Number(part.trim()))
    .filter((number) => Number.isFinite(number));
}

function escapeCsv(value: string) {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function academicOfferRowsToCsvText(rows: NormalizedAcademicOfferRow[]) {
  const lines = [ACADEMIC_OFFER_HEADERS.join(",")];
  for (const row of rows) {
    const cells = [
      pickField(row, FIELD_ALIASES.cycle),
      pickField(row, FIELD_ALIASES.campus),
      pickField(row, FIELD_ALIASES.program),
      pickField(row, FIELD_ALIASES.line),
      pickField(row, FIELD_ALIASES.modality),
      pickField(row, FIELD_ALIASES.plan),
      pickField(row, FIELD_ALIASES.module),
      pickField(row, FIELD_ALIASES.moduleCount),
      pickField(row, FIELD_ALIASES.schoolSchedule),
      pickField(row, FIELD_ALIASES.executiveSchedule),
      pickField(row, FIELD_ALIASES.status) || "Activo",
    ];
    lines.push(cells.map(escapeCsv).join(","));
  }
  return lines.join("\n");
}

export function validateAcademicOfferRows(rows: NormalizedAcademicOfferRow[]):
  | { ok: true; rowErrors: [] }
  | { ok: false; rowErrors: AcademicOfferRowError[] } {
  const rowErrors: AcademicOfferRowError[] = [];

  for (const row of rows) {
    const cycle = pickField(row, FIELD_ALIASES.cycle);
    if (cycle && !normalizeAcademicOfferCycle(cycle)) {
      addRowError(
        rowErrors,
        row.row,
        "ciclo",
        "INVALID_CYCLE",
        `El ciclo debe ser ${ACADEMIC_OFFER_CYCLES.join(", ")}.`,
      );
    }

    if (!pickField(row, FIELD_ALIASES.campus)) {
      addRowError(rowErrors, row.row, "plantel", "REQUIRED_FIELD", "El plantel es obligatorio.");
    }

    if (!pickField(row, FIELD_ALIASES.program)) {
      addRowError(rowErrors, row.row, "programa", "REQUIRED_FIELD", "El programa es obligatorio.");
    }

    const modality = pickField(row, FIELD_ALIASES.modality);
    if (modality && !ALLOWED_MODALITY_KEYS.has(normalizeHeader(modality))) {
      addRowError(
        rowErrors,
        row.row,
        "modalidad",
        "INVALID_MODALITY",
        "La modalidad debe ser presencial, mixta, ejecutivo u online.",
      );
    }

    const plan = pickField(row, FIELD_ALIASES.plan);
    if (plan) {
      const plans = parsePlanNumbers(plan);
      if (!plans.length || plans.some((value) => !ALLOWED_PLANS.has(value))) {
        addRowError(
          rowErrors,
          row.row,
          "plan",
          "INVALID_PLAN",
          "Los planes permitidos son 4, 9 y 11.",
        );
      }
    }

    const academicModule = pickField(row, FIELD_ALIASES.module);
    if (
      academicModule &&
      !normalizeAcademicModule(academicModule) &&
      parseAcademicModuleTokens(academicModule).length === 0
    ) {
      addRowError(
        rowErrors,
        row.row,
        "modulo",
        "INVALID_MODULE",
        "El modulo debe ser Longitudinal, Modular, M1, M2 o M3.",
      );
    }
  }

  return rowErrors.length ? { ok: false, rowErrors } : { ok: true, rowErrors: [] };
}
