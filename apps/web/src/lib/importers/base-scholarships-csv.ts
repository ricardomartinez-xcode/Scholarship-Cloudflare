import {
  BenefitBusinessLine,
  CanonicalModality,
  EnrollmentType,
} from "@prisma/client";

import {
  canonicalImportText,
  loadImporterAliasRows,
  type ImporterAliasOptions,
} from "@/lib/importers/configured-aliases";
import {
  buildImportHeaderMap,
  findImportColumnIndex,
  normalizeBusinessLineForImport,
  normalizeEnrollmentTypeForImport,
  normalizeModalityForImport,
  normalizeOptionalImportScopeText,
  normalizeProgramKeyForImport,
  normalizeTierForImport,
  parseImportDelimitedText,
  parseImportMoney,
  readImportCell,
} from "@/lib/importers/global-import-normalization";
import { prisma } from "@/lib/prisma";

export type BaseScholarshipImportDiffAction = "create" | "update" | "noop";

export type BaseScholarshipImportPreviewRow = {
  rowNumber: number;
  action: BaseScholarshipImportDiffAction;
  region: string | null;
  plantel: string | null;
  programaKey: string | null;
  tier: string;
  enrollmentType: EnrollmentType;
  businessLine: BenefitBusinessLine;
  modality: CanonicalModality;
  plan: number;
  minAverage: number;
  maxAverage: number;
  scholarshipPercent: number;
  notes: string | null;
};

export type PreparedBaseScholarshipsImportPayloadRow =
  BaseScholarshipImportPreviewRow & {
    key: string;
    existingId: string | null;
  };

export type PreparedBaseScholarshipsImportPayload = {
  rows: PreparedBaseScholarshipsImportPayloadRow[];
};

export type BaseScholarshipsImportPrepareResult = {
  summary: {
    processed: number;
    ready: number;
    created: number;
    updated: number;
    unchanged: number;
    warnings: string[];
    errors: string[];
  };
  previewRows: BaseScholarshipImportPreviewRow[];
  payload: PreparedBaseScholarshipsImportPayload;
};

export type BaseScholarshipsImportApplySummary = {
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
};

type ParsedBaseScholarshipRow = Omit<
  BaseScholarshipImportPreviewRow,
  "action"
>;

const HEADER_ALIASES = {
  region: ["region", "región"],
  plantel: ["plantel", "campus", "sede"],
  programaKey: ["programa", "programakey", "programa_key", "program", "program_key", "carrera"],
  tier: ["tier"],
  enrollmentType: ["enrollmenttype", "tipoingreso", "ingreso"],
  businessLine: ["businessline", "lineanegocio", "lineadenegocio", "linea", "nivel"],
  modality: ["modality", "modalidad"],
  plan: ["plan"],
  averageRange: ["promedio", "rango", "average", "averagerange"],
  minAverage: ["promediomin", "minaverage", "rango_min", "min"],
  maxAverage: ["promediomax", "maxaverage", "rango_max", "max"],
  scholarshipPercent: ["porcentaje", "porcentaje_beca", "porcentaje beca", "beca", "scholarshippercent", "percent"],
  notes: ["notes", "nota", "notas"],
} as const;

function findColumnIndex(headerMap: Map<string, number>, aliases: readonly string[]) {
  return findImportColumnIndex(headerMap, aliases);
}

function readCell(row: string[], index: number): string {
  return readImportCell(row, index);
}

function normalizeEnrollmentTypeValue(
  value: string,
  aliases: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  return normalizeEnrollmentTypeForImport(value, aliases) as EnrollmentType | null;
}

function normalizeBusinessLineValue(
  value: string,
  aliases: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  return normalizeBusinessLineForImport(value, aliases) as BenefitBusinessLine | null;
}

function normalizeModalityValue(
  value: string,
  aliases: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  return normalizeModalityForImport(value, aliases) as CanonicalModality | null;
}

function parseNumber(value: string) {
  return parseImportMoney(value.replace("%", ""));
}

function parseAverageRange(value: string) {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
  if (!normalized) return null;
  const match = normalized.match(/^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  const min = parseNumber(match[1] ?? "");
  const max = parseNumber(match[2] ?? "");
  if (min === null || max === null) return null;
  return { minAverage: min, maxAverage: max };
}

function normalizeTier(
  value: string,
  modality: CanonicalModality,
  aliases: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  if (modality === CanonicalModality.online) return "ANY";
  return normalizeTierForImport(value, aliases) ?? "ANY";
}

function buildBaseScholarshipKey(input: {
  enrollmentType: EnrollmentType;
  businessLine: BenefitBusinessLine;
  modality: CanonicalModality;
  plan: number;
  tier: string;
  region?: string | null;
  plantel?: string | null;
  programaKey?: string | null;
  minAverage: number;
  maxAverage: number;
}) {
  return [
    input.enrollmentType,
    input.businessLine,
    input.modality,
    input.plan,
    input.tier,
    input.region ?? "",
    input.plantel ?? "",
    input.programaKey ?? "",
    input.minAverage,
    input.maxAverage,
  ].join("|");
}

function hasRuleValueChanged(
  existing: { scholarshipPercent: number | null },
  row: ParsedBaseScholarshipRow,
) {
  return existing.scholarshipPercent !== row.scholarshipPercent;
}

async function buildExistingBaseScholarshipsByKey() {
  const rows = await prisma.scholarshipRule.findMany({
    where: { sourceVersion: "canonical" },
    select: {
      id: true,
      enrollmentType: true,
      businessLine: true,
      modality: true,
      plan: true,
      campusTier: true,
      region: true,
      plantel: true,
      programaKey: true,
      minAverage: true,
      maxAverage: true,
      scholarshipPercent: true,
    },
  });

  const map = new Map<string, { id: string; scholarshipPercent: number | null }>();
  for (const row of rows) {
    if (row.minAverage === null || row.maxAverage === null) continue;
    map.set(
      buildBaseScholarshipKey({
        enrollmentType: row.enrollmentType,
        businessLine: row.businessLine,
        modality: row.modality,
        plan: row.plan,
        tier: row.campusTier || "ANY",
        region: row.region || null,
        plantel: row.plantel || null,
        programaKey: row.programaKey || null,
        minAverage: Number(row.minAverage),
        maxAverage: Number(row.maxAverage),
      }),
      {
        id: row.id,
        scholarshipPercent:
          row.scholarshipPercent === null ? null : Number(row.scholarshipPercent),
      },
    );
  }
  return map;
}

export async function prepareBaseScholarshipsCsvImport(input: {
  file: File;
} & ImporterAliasOptions): Promise<BaseScholarshipsImportPrepareResult> {
  const text = await input.file.text();
  const rows = parseImportDelimitedText(text);
  if (rows.length < 2) {
    throw new Error("El CSV debe contener encabezado y al menos una fila de datos.");
  }

  const headerMap = buildImportHeaderMap(rows[0] ?? []);

  const idxEnrollmentType = findColumnIndex(headerMap, HEADER_ALIASES.enrollmentType);
  const idxBusinessLine = findColumnIndex(headerMap, HEADER_ALIASES.businessLine);
  const idxModality = findColumnIndex(headerMap, HEADER_ALIASES.modality);
  const idxPlan = findColumnIndex(headerMap, HEADER_ALIASES.plan);
  const idxScholarshipPercent = findColumnIndex(
    headerMap,
    HEADER_ALIASES.scholarshipPercent,
  );

  if (
    idxEnrollmentType < 0 ||
    idxBusinessLine < 0 ||
    idxModality < 0 ||
    idxPlan < 0 ||
    idxScholarshipPercent < 0
  ) {
    throw new Error(
      "Faltan columnas obligatorias: linea, ingreso, modalidad, plan y porcentaje.",
    );
  }

  const idxRegion = findColumnIndex(headerMap, HEADER_ALIASES.region);
  const idxPlantel = findColumnIndex(headerMap, HEADER_ALIASES.plantel);
  const idxProgramaKey = findColumnIndex(headerMap, HEADER_ALIASES.programaKey);
  const idxTier = findColumnIndex(headerMap, HEADER_ALIASES.tier);
  const idxAverageRange = findColumnIndex(headerMap, HEADER_ALIASES.averageRange);
  const idxMinAverage = findColumnIndex(headerMap, HEADER_ALIASES.minAverage);
  const idxMaxAverage = findColumnIndex(headerMap, HEADER_ALIASES.maxAverage);
  const idxNotes = findColumnIndex(headerMap, HEADER_ALIASES.notes);

  if (idxAverageRange < 0 && (idxMinAverage < 0 || idxMaxAverage < 0)) {
    throw new Error("Falta columna de promedio: promedio o promedio_min/promedio_max.");
  }

  const [existingByKey, aliasRows] = await Promise.all([
    buildExistingBaseScholarshipsByKey(),
    loadImporterAliasRows(input),
  ]);
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsedRows: ParsedBaseScholarshipRow[] = [];
  const seenKeys = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (!row.some((cell) => String(cell ?? "").trim())) continue;
    const rowNumber = index + 1;

    const enrollmentTypeRaw = readCell(row, idxEnrollmentType);
    const businessLineRaw = readCell(row, idxBusinessLine);
    const modalityRaw = readCell(row, idxModality);
    const enrollmentType = normalizeEnrollmentTypeValue(enrollmentTypeRaw, aliasRows);
    const businessLine = normalizeBusinessLineValue(businessLineRaw, aliasRows);
    const modality = normalizeModalityValue(modalityRaw, aliasRows);
    const plan = parseNumber(readCell(row, idxPlan));
    const percent = parseNumber(readCell(row, idxScholarshipPercent));

    if (!enrollmentType) {
      errors.push(`Fila ${rowNumber}: ingreso inválido "${enrollmentTypeRaw}".`);
      continue;
    }
    if (!businessLine) {
      errors.push(`Fila ${rowNumber}: linea inválida "${businessLineRaw}".`);
      continue;
    }
    if (!modality) {
      errors.push(`Fila ${rowNumber}: modalidad inválida "${modalityRaw}".`);
      continue;
    }
    if (plan === null || !Number.isInteger(plan) || plan <= 0) {
      errors.push(`Fila ${rowNumber}: plan debe ser entero mayor que 0.`);
      continue;
    }
    if (percent === null || percent < 0 || percent > 100) {
      errors.push(`Fila ${rowNumber}: porcentaje debe estar entre 0 y 100.`);
      continue;
    }

    const range =
      idxAverageRange >= 0
        ? parseAverageRange(readCell(row, idxAverageRange))
        : {
            minAverage: parseNumber(readCell(row, idxMinAverage)),
            maxAverage: parseNumber(readCell(row, idxMaxAverage)),
          };
    if (
      !range ||
      range.minAverage === null ||
      range.maxAverage === null ||
      range.minAverage < 0 ||
      range.maxAverage > 10 ||
      range.minAverage > range.maxAverage
    ) {
      errors.push(`Fila ${rowNumber}: promedio debe ser un rango válido entre 0 y 10.`);
      continue;
    }

    const tier = normalizeTier(readCell(row, idxTier), modality, aliasRows);
    if (modality === CanonicalModality.online && readCell(row, idxTier)) {
      warnings.push(`Fila ${rowNumber}: tier se ignoró porque modalidad=online.`);
    }

    const parsedRow: ParsedBaseScholarshipRow = {
      rowNumber,
      region: normalizeOptionalImportScopeText(readCell(row, idxRegion)),
      plantel: normalizeOptionalImportScopeText(canonicalImportText(aliasRows, "campus", readCell(row, idxPlantel))),
      programaKey: normalizeProgramKeyForImport(readCell(row, idxProgramaKey), aliasRows),
      tier,
      enrollmentType,
      businessLine,
      modality,
      plan,
      minAverage: range.minAverage,
      maxAverage: range.maxAverage,
      scholarshipPercent: percent,
      notes: readCell(row, idxNotes) || null,
    };
    const key = buildBaseScholarshipKey(parsedRow);
    if (seenKeys.has(key)) {
      errors.push(`Fila ${rowNumber}: regla duplicada dentro del CSV.`);
      continue;
    }
    seenKeys.add(key);
    parsedRows.push(parsedRow);
  }

  const payloadRows: PreparedBaseScholarshipsImportPayloadRow[] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const parsedRow of parsedRows) {
    const key = buildBaseScholarshipKey(parsedRow);
    const existing = existingByKey.get(key) ?? null;
    const action: BaseScholarshipImportDiffAction = !existing
      ? "create"
      : hasRuleValueChanged(existing, parsedRow)
        ? "update"
        : "noop";
    if (action === "create") created += 1;
    else if (action === "update") updated += 1;
    else unchanged += 1;

    payloadRows.push({
      ...parsedRow,
      action,
      key,
      existingId: existing?.id ?? null,
    });
  }

  return {
    summary: {
      processed: parsedRows.length,
      ready: payloadRows.length,
      created,
      updated,
      unchanged,
      warnings,
      errors,
    },
    previewRows: payloadRows.slice(0, 120),
    payload: { rows: payloadRows },
  };
}

export async function applyPreparedBaseScholarshipsImport(params: {
  payload: PreparedBaseScholarshipsImportPayload;
  updatedBy: string;
}): Promise<BaseScholarshipsImportApplySummary> {
  const rows = params.payload.rows ?? [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      if (row.action === "noop") {
        unchanged += 1;
        continue;
      }

      const data = {
        enrollmentType: row.enrollmentType,
        businessLine: row.businessLine,
        modality: row.modality,
        plan: row.plan,
        campusTier: row.tier,
        region: row.region ?? "",
        plantel: row.plantel ?? "",
        programaKey: row.programaKey ?? "",
        minAverage: row.minAverage,
        maxAverage: row.maxAverage,
        scholarshipPercent: row.scholarshipPercent,
        discountedPriceMxn: null,
        origin: row.notes ? `admin-import: ${row.notes}` : "admin-import",
        sourceVersion: "canonical",
      };

      if (row.existingId) {
        const exists = await tx.scholarshipRule.findUnique({
          where: { id: row.existingId },
          select: { id: true },
        });
        if (exists) {
          await tx.scholarshipRule.update({
            where: { id: row.existingId },
            data,
          });
          updated += 1;
          continue;
        }
      }

      await tx.scholarshipRule.create({ data });
      created += 1;
    }
  });

  return {
    processed: rows.length,
    created,
    updated,
    unchanged,
  };
}
