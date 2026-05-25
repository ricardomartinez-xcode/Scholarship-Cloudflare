import {
  BenefitBusinessLine,
  CanonicalModality,
  EnrollmentType,
} from "@prisma/client";

import { parseCsvText, normalizeHeader } from "@/lib/importers/csv-utils";
import { prisma } from "@/lib/prisma";

export type BaseScholarshipImportDiffAction = "create" | "update" | "noop";

export type BaseScholarshipImportPreviewRow = {
  rowNumber: number;
  action: BaseScholarshipImportDiffAction;
  region: string | null;
  plantel: string | null;
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
  tier: ["tier"],
  enrollmentType: ["enrollmenttype", "tipoingreso", "ingreso"],
  businessLine: ["businessline", "lineanegocio", "lineadenegocio", "linea", "nivel"],
  modality: ["modality", "modalidad"],
  plan: ["plan"],
  averageRange: ["promedio", "rango", "average", "averagerange"],
  minAverage: ["promediomin", "minaverage", "rango_min", "min"],
  maxAverage: ["promediomax", "maxaverage", "rango_max", "max"],
  scholarshipPercent: ["porcentaje", "beca", "scholarshippercent", "percent"],
  notes: ["notes", "nota", "notas"],
} as const;

function findColumnIndex(headerMap: Map<string, number>, aliases: readonly string[]) {
  for (const alias of aliases) {
    const index = headerMap.get(alias);
    if (typeof index === "number") return index;
  }
  return -1;
}

function readCell(row: string[], index: number): string {
  if (index < 0) return "";
  return String(row[index] ?? "").trim();
}

function normalizeHumanValue(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEnrollmentTypeValue(value: string) {
  const normalized = normalizeHumanValue(value);
  const enrollmentMap: Record<string, EnrollmentType> = {
    "nuevo ingreso": EnrollmentType.nuevo_ingreso,
    ni: EnrollmentType.nuevo_ingreso,
    regreso: EnrollmentType.regreso,
    reingreso: EnrollmentType.reingreso,
  };
  return enrollmentMap[normalized] ?? null;
}

function normalizeBusinessLineValue(value: string) {
  const normalized = normalizeHumanValue(value);
  const businessLineMap: Record<string, BenefitBusinessLine> = {
    licenciatura: BenefitBusinessLine.licenciatura,
    "licenciatura escolarizada": BenefitBusinessLine.licenciatura,
    "licenciatura mixta": BenefitBusinessLine.licenciatura,
    "licenciatura online": BenefitBusinessLine.licenciatura,
    prepa: BenefitBusinessLine.prepa,
    preparatoria: BenefitBusinessLine.prepa,
    bachillerato: BenefitBusinessLine.prepa,
    "bachillerato escolarizado": BenefitBusinessLine.prepa,
    "bachillerato online": BenefitBusinessLine.prepa,
    posgrado: BenefitBusinessLine.posgrado,
    maestria: BenefitBusinessLine.posgrado,
    salud: BenefitBusinessLine.salud,
  };
  return businessLineMap[normalized] ?? null;
}

function normalizeModalityValue(value: string) {
  const normalized = normalizeHumanValue(value);
  const modalityMap: Record<string, CanonicalModality> = {
    presencial: CanonicalModality.presencial,
    escolarizada: CanonicalModality.presencial,
    escolarizado: CanonicalModality.presencial,
    mixta: CanonicalModality.mixta,
    ejecutiva: CanonicalModality.mixta,
    ejecutivo: CanonicalModality.mixta,
    online: CanonicalModality.online,
    "en linea": CanonicalModality.online,
  };
  return modalityMap[normalized] ?? null;
}

function parseNumber(value: string) {
  const normalized = value.trim().replace("%", "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAverageRange(value: string) {
  const normalized = value.trim().replace(/\s+/g, "");
  if (!normalized) return null;
  const match = normalized.match(/^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  const min = parseNumber(match[1] ?? "");
  const max = parseNumber(match[2] ?? "");
  if (min === null || max === null) return null;
  return { minAverage: min, maxAverage: max };
}

function normalizeTier(value: string, modality: CanonicalModality) {
  const raw = value.trim().toUpperCase();
  if (modality === CanonicalModality.online) return "ANY";
  if (!raw || raw === "GENERAL" || raw === "TODOS" || raw === "ANY") return "ANY";
  return raw;
}

function buildBaseScholarshipKey(input: {
  enrollmentType: EnrollmentType;
  businessLine: BenefitBusinessLine;
  modality: CanonicalModality;
  plan: number;
  tier: string;
  minAverage: number;
  maxAverage: number;
}) {
  return [
    input.enrollmentType,
    input.businessLine,
    input.modality,
    input.plan,
    input.tier,
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
}): Promise<BaseScholarshipsImportPrepareResult> {
  const text = await input.file.text();
  const rows = parseCsvText(text);
  if (rows.length < 2) {
    throw new Error("El CSV debe contener encabezado y al menos una fila de datos.");
  }

  const headerMap = new Map<string, number>();
  (rows[0] ?? []).forEach((cell, index) => {
    headerMap.set(normalizeHeader(cell), index);
  });

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
  const idxTier = findColumnIndex(headerMap, HEADER_ALIASES.tier);
  const idxAverageRange = findColumnIndex(headerMap, HEADER_ALIASES.averageRange);
  const idxMinAverage = findColumnIndex(headerMap, HEADER_ALIASES.minAverage);
  const idxMaxAverage = findColumnIndex(headerMap, HEADER_ALIASES.maxAverage);
  const idxNotes = findColumnIndex(headerMap, HEADER_ALIASES.notes);

  if (idxAverageRange < 0 && (idxMinAverage < 0 || idxMaxAverage < 0)) {
    throw new Error("Falta columna de promedio: promedio o promedio_min/promedio_max.");
  }

  const existingByKey = await buildExistingBaseScholarshipsByKey();
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
    const enrollmentType = normalizeEnrollmentTypeValue(enrollmentTypeRaw);
    const businessLine = normalizeBusinessLineValue(businessLineRaw);
    const modality = normalizeModalityValue(modalityRaw);
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

    const tier = normalizeTier(readCell(row, idxTier), modality);
    if (modality === CanonicalModality.online && readCell(row, idxTier)) {
      warnings.push(`Fila ${rowNumber}: tier se ignoró porque modalidad=online.`);
    }

    const parsedRow: ParsedBaseScholarshipRow = {
      rowNumber,
      region: readCell(row, idxRegion) || null,
      plantel: readCell(row, idxPlantel) || null,
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
