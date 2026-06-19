import {
  AcademicFeeSection,
  AdminAdditionalBenefitType,
  BenefitDuration,
  type BenefitBusinessLine,
  type BenefitModality,
  type CanonicalModality,
  type EnrollmentType,
} from "@prisma/client";

import {
  normalizeAliasKey,
  type CanonicalAliasRuntimeRow,
} from "@/lib/admin-canonical-aliases";
import { normalizeHeader } from "@/lib/importers/csv-utils";
import { canonicalImportText } from "@/lib/importers/configured-aliases";
import {
  normalizeBusinessLineWithAliases,
  normalizeCanonicalModalityWithAliases,
  normalizeEnrollmentTypeWithAliases,
  normalizeTierWithAliases,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
  type EnrollmentTypeValue,
} from "@/lib/pricing-normalize";

export type ImportAliasRows = CanonicalAliasRuntimeRow[] | null | undefined;

export function normalizeImportHumanValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAllScopeValue(value: unknown) {
  const normalized = normalizeImportHumanValue(value);
  return (
    !normalized ||
    normalized === "all" ||
    normalized === "any" ||
    normalized === "todos" ||
    normalized === "todas" ||
    normalized === "todo" ||
    normalized === "toda" ||
    normalized === "general" ||
    normalized === "cualquiera" ||
    normalized === "cualquier ingreso"
  );
}

export function parseImportBoolean(value: unknown, defaultValue: boolean) {
  const normalized = normalizeImportHumanValue(value);
  if (!normalized) return defaultValue;
  if (
    ["1", "true", "verdadero", "si", "yes", "y", "x", "activo", "activa", "visible"].includes(
      normalized,
    )
  ) {
    return true;
  }
  if (
    ["0", "false", "falso", "no", "n", "inactivo", "inactiva", "oculto", "oculta"].includes(
      normalized,
    )
  ) {
    return false;
  }
  return defaultValue;
}

export function parseImportMoney(value: unknown) {
  const raw = String(value ?? "")
    .trim()
    .replace(/\$/g, "")
    .replace(/\s+/g, "");
  if (!raw) return null;

  let normalized = raw;
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    normalized =
      raw.lastIndexOf(",") > raw.lastIndexOf(".")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else if (hasComma) {
    const parts = raw.split(",");
    normalized =
      parts.length === 2 && (parts[1] ?? "").length <= 2
        ? `${parts[0]}.${parts[1]}`
        : raw.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseImportNonNegativeMoney(value: unknown) {
  const parsed = parseImportMoney(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

export function parseImportInteger(value: unknown) {
  const parsed = parseImportMoney(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function countDelimiterOutsideQuotes(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const ch = line[index];
    if (ch === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) count += 1;
  }
  return count;
}

export function detectImportDelimiter(line: string) {
  const candidates = [",", ";", "|"] as const;
  return candidates.reduce<(typeof candidates)[number]>((best, candidate) => {
    const bestCount = countDelimiterOutsideQuotes(line, best);
    const nextCount = countDelimiterOutsideQuotes(line, candidate);
    return nextCount > bestCount ? candidate : best;
  }, ",");
}

export function parseImportDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const ch = line[index];
    if (ch === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(current.trim().replace(/^\uFEFF/, ""));
      current = "";
      continue;
    }
    current += ch;
  }

  cells.push(current.trim().replace(/^\uFEFF/, ""));
  return cells;
}

export function parseImportDelimitedText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  if (!lines.length) return [] as string[][];
  const delimiter = detectImportDelimiter(lines[0] ?? "");
  return lines.map((line) => parseImportDelimitedLine(line, delimiter));
}

export function buildImportHeaderMap(header: string[]) {
  const headerMap = new Map<string, number>();
  header.forEach((cell, index) => {
    headerMap.set(normalizeHeader(cell), index);
  });
  return headerMap;
}

export function findImportColumnIndex(
  headerMap: Map<string, number>,
  aliases: readonly string[],
) {
  for (const alias of aliases) {
    const index = headerMap.get(normalizeHeader(alias));
    if (typeof index === "number") return index;
  }
  return -1;
}

export function readImportCell(row: string[], index: number) {
  if (index < 0) return "";
  return String(row[index] ?? "").trim();
}

export function normalizeOptionalImportScopeText(value: unknown) {
  const trimmed = String(value ?? "").trim();
  return isAllScopeValue(trimmed) ? null : trimmed;
}

export function normalizeProgramKeyForImport(
  value: unknown,
  aliasRows?: ImportAliasRows,
) {
  const canonical = canonicalImportText(aliasRows ?? [], "program", String(value ?? ""));
  if (isAllScopeValue(canonical)) return null;
  const normalized = normalizeAliasKey(canonical);
  if (
    !normalized ||
    normalized === "canonical" ||
    normalized === "canonico" ||
    normalized === "nuevo_ingreso" ||
    normalized === "regreso" ||
    normalized === "reingreso"
  ) {
    return null;
  }
  return normalized;
}

export function normalizeBusinessLineForImport(
  value: unknown,
  aliasRows?: ImportAliasRows,
): CanonicalBusinessLine | null {
  const configured = normalizeBusinessLineWithAliases(String(value ?? ""), aliasRows ?? []);
  if (configured) return configured;

  const normalized = normalizeImportHumanValue(value);
  const map: Record<string, CanonicalBusinessLine> = {
    salud: "salud",
    licenciatura: "licenciatura",
    "licenciatura escolarizada": "licenciatura",
    "licenciatura mixta": "licenciatura",
    "licenciatura online": "licenciatura",
    lic: "licenciatura",
    prepa: "prepa",
    preparatoria: "prepa",
    bachillerato: "prepa",
    "bachillerato escolarizado": "prepa",
    "bachillerato online": "prepa",
    bachiller: "prepa",
    posgrado: "posgrado",
    maestria: "posgrado",
    maestrias: "posgrado",
    master: "posgrado",
    doctorado: "posgrado",
  };
  return map[normalized] ?? null;
}

export function normalizeLegacyPriceBusinessLineForImport(
  value: unknown,
  aliasRows?: ImportAliasRows,
) {
  const canonical = normalizeBusinessLineForImport(value, aliasRows);
  if (canonical === "prepa") return "preparatoria";
  if (canonical === "posgrado") return "maestria";
  return canonical ?? String(value ?? "").trim().toLowerCase();
}

export function normalizeModalityForImport(
  value: unknown,
  aliasRows?: ImportAliasRows,
): CanonicalModalityValue | null {
  const configured = normalizeCanonicalModalityWithAliases(String(value ?? ""), aliasRows ?? []);
  if (configured) return configured;

  const normalized = normalizeImportHumanValue(value);
  if (normalized.includes("online") || normalized === "en linea") return "online";
  if (["mixta", "mixto", "ejecutiva", "ejecutivo", "mixto ejecutivo"].includes(normalized)) {
    return "mixta";
  }
  if (["presencial", "escolarizada", "escolarizado"].includes(normalized)) {
    return "presencial";
  }
  return null;
}

export function normalizeEnrollmentTypeForImport(
  value: unknown,
  aliasRows?: ImportAliasRows,
): EnrollmentTypeValue | null {
  const configured = normalizeEnrollmentTypeWithAliases(String(value ?? ""), aliasRows ?? []);
  if (configured) return configured;

  const normalized = normalizeImportHumanValue(value);
  const map: Record<string, EnrollmentTypeValue> = {
    "nuevo ingreso": "nuevo_ingreso",
    ni: "nuevo_ingreso",
    regreso: "regreso",
    reingreso: "reingreso",
  };
  return map[normalized] ?? null;
}

export function normalizeTierForImport(
  value: unknown,
  aliasRows?: ImportAliasRows,
  options?: { nullForAny?: boolean },
) {
  const raw = normalizeTierWithAliases(
    canonicalImportText(aliasRows ?? [], "tier", String(value ?? "")),
    aliasRows ?? [],
  )
    .trim()
    .toUpperCase();
  if (!raw || raw === "ANY" || raw === "GENERAL" || raw === "TODOS" || raw === "ONLINE" || raw === "OL") {
    return options?.nullForAny ? null : "ANY";
  }
  const match = raw.match(/(?:TIER|T)\s*([0-9]+)/);
  return match ? `T${match[1]}` : raw;
}

const ACTIVE_IMPORT_BENEFIT_TYPES = new Set<AdminAdditionalBenefitType>([
  AdminAdditionalBenefitType.percentage,
  AdminAdditionalBenefitType.first_payment,
]);

export function normalizeBenefitTypeForImport(value: unknown) {
  const raw = String(value ?? "").trim();
  if (ACTIVE_IMPORT_BENEFIT_TYPES.has(raw as AdminAdditionalBenefitType)) {
    return raw as AdminAdditionalBenefitType;
  }

  const normalized = normalizeImportHumanValue(raw);
  const map: Record<string, AdminAdditionalBenefitType> = {
    porcentaje: AdminAdditionalBenefitType.percentage,
    "porcentaje adicional": AdminAdditionalBenefitType.percentage,
    adicional: AdminAdditionalBenefitType.percentage,
    percentage: AdminAdditionalBenefitType.percentage,
    percent: AdminAdditionalBenefitType.percentage,
    "primer pago": AdminAdditionalBenefitType.first_payment,
    "pago inicial": AdminAdditionalBenefitType.first_payment,
    "first payment": AdminAdditionalBenefitType.first_payment,
  };
  return map[normalized] ?? null;
}

export function normalizeBenefitDurationForImport(value: unknown) {
  const raw = String(value ?? "").trim();
  if (isAllScopeValue(raw)) return null;
  if (Object.values(BenefitDuration).includes(raw as BenefitDuration)) {
    return raw as BenefitDuration;
  }

  const normalized = normalizeImportHumanValue(raw);
  const map: Record<string, BenefitDuration> = {
    "1 cuatrimestre": BenefitDuration.primer_cuatrimestre,
    "1er cuatrimestre": BenefitDuration.primer_cuatrimestre,
    "un cuatrimestre": BenefitDuration.primer_cuatrimestre,
    "primer cuatrimestre": BenefitDuration.primer_cuatrimestre,
    "primer cuatri": BenefitDuration.primer_cuatrimestre,
    "1 cuatri": BenefitDuration.primer_cuatrimestre,
    "1er cuatri": BenefitDuration.primer_cuatrimestre,
    "toda la carrera": BenefitDuration.toda_la_carrera,
    "toda carrera": BenefitDuration.toda_la_carrera,
    "pago inicial": BenefitDuration.pago_inicial,
    "primer pago": BenefitDuration.pago_inicial,
  };
  return map[normalized] ?? null;
}

export function normalizeAcademicFeeSectionForImport(value: unknown) {
  const normalized = normalizeImportHumanValue(value).toUpperCase();
  if (normalized === "EXAMENES") return AcademicFeeSection.EXAMENES;
  if (normalized === "TRAMITES") return AcademicFeeSection.TRAMITES;
  if (normalized === "DIVERSOS") return AcademicFeeSection.DIVERSOS;
  return null;
}

export function normalizeImportPlan(value: unknown) {
  const match = String(value ?? "").trim().match(/[0-9]+/);
  return match?.[0] ?? String(value ?? "").trim();
}

export type ImportBenefitBusinessLine = BenefitBusinessLine | null;
export type ImportBenefitModality = BenefitModality | null;
export type ImportCanonicalModality = CanonicalModality | null;
export type ImportEnrollmentType = EnrollmentType | null;
