import {
  AdminAdditionalBenefitType,
  BenefitBusinessLine,
  BenefitDuration,
  BenefitModality,
  EnrollmentType,
} from "@prisma/client";

import { parseCsvText, normalizeHeader } from "@/lib/importers/csv-utils";
import {
  addConfiguredCampusAliasesToLookup,
  canonicalImportKey,
  canonicalImportText,
  loadImporterAliasRows,
  type ImporterAliasOptions,
} from "@/lib/importers/configured-aliases";
import { normalizeTierWithAliases } from "@/lib/pricing-normalize";
import { prisma } from "@/lib/prisma";

export type BenefitImportDiffAction = "create" | "update" | "noop";

export type BenefitImportPreviewRow = {
  rowNumber: number;
  action: BenefitImportDiffAction;
  region: string | null;
  tier: string | null;
  benefitType: AdminAdditionalBenefitType;
  enrollmentType: EnrollmentType | null;
  businessLine: BenefitBusinessLine | null;
  modality: BenefitModality | null;
  duration: BenefitDuration | null;
  appliesToAll: boolean;
  campusIds: string[];
  campusLabels: string[];
  extraPercent: number;
  firstPaymentAmount: number;
  isActive: boolean;
  notes: string | null;
};

export type PreparedBenefitsImportPayloadRow = BenefitImportPreviewRow & {
  key: string;
  existingId: string | null;
};

export type PreparedBenefitsImportPayload = {
  rows: PreparedBenefitsImportPayloadRow[];
};

export type BenefitsImportPrepareResult = {
  summary: {
    processed: number;
    ready: number;
    created: number;
    updated: number;
    unchanged: number;
    warnings: string[];
    errors: string[];
  };
  previewRows: BenefitImportPreviewRow[];
  payload: PreparedBenefitsImportPayload;
};

export type BenefitsImportApplySummary = {
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
};

type ParsedBenefitRow = {
  rowNumber: number;
  region: string | null;
  tier: string | null;
  benefitType: AdminAdditionalBenefitType;
  enrollmentType: EnrollmentType | null;
  businessLine: BenefitBusinessLine | null;
  modality: BenefitModality | null;
  duration: BenefitDuration | null;
  appliesToAll: boolean;
  campusIds: string[];
  campusLabels: string[];
  extraPercent: number;
  firstPaymentAmount: number;
  isActive: boolean;
  notes: string | null;
};

const ACTIVE_BENEFIT_TYPES = [
  AdminAdditionalBenefitType.percentage,
  AdminAdditionalBenefitType.first_payment,
] as const;
const BENEFIT_TYPE_SET = new Set<AdminAdditionalBenefitType>(ACTIVE_BENEFIT_TYPES);
const BUSINESS_LINE_SET = new Set(Object.values(BenefitBusinessLine));
const MODALITY_SET = new Set(Object.values(BenefitModality));
const DURATION_SET = new Set(Object.values(BenefitDuration));
const ENROLLMENT_SET = new Set(Object.values(EnrollmentType));

const HEADER_ALIASES = {
  region: ["region", "región"],
  tier: ["tier"],
  benefitType: ["benefittype", "tipo", "tipobeneficio"],
  campusIds: ["campusids", "campuses", "campus", "plantel", "planteles", "campusid"],
  appliesToAll: ["appliestoall", "todosplanteles", "allcampuses", "todos"],
  enrollmentType: ["enrollmenttype", "tipoingreso", "ingreso"],
  businessLine: ["businessline", "business_line", "lineanegocio", "linea"],
  modality: ["modality", "modalidad"],
  duration: ["duration", "duracion"],
  extraPercent: ["extrapercent", "porcentaje", "extra", "percent"],
  firstPaymentAmount: ["firstpaymentamount", "primerpago", "monto", "montoinicial"],
  isActive: ["isactive", "activo", "active"],
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

function parseOptionalEnum<T extends string>(
  value: string,
  allowed: Set<T>,
): T | null {
  const normalized = value.trim();
  if (!normalized || normalized === "__ALL__") return null;
  return allowed.has(normalized as T) ? (normalized as T) : null;
}

function parseBoolean(value: string, defaultValue: boolean) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "si", "sí", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

function parseCampusIdentifiers(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  return Array.from(
    new Set(
      trimmed
        .split(/[|;]+/)
        .flatMap((chunk) => chunk.split(","))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeDurationForKey(
  benefitType: AdminAdditionalBenefitType,
  duration: BenefitDuration | null,
) {
  if (benefitType === AdminAdditionalBenefitType.first_payment) {
    return BenefitDuration.pago_inicial;
  }
  return duration ?? "__ANY__";
}

function buildBenefitScopeKey(input: {
  benefitType: AdminAdditionalBenefitType;
  enrollmentType: EnrollmentType | null;
  businessLine: BenefitBusinessLine | null;
  modality: BenefitModality | null;
  duration: BenefitDuration | null;
  appliesToAll: boolean;
  campusIds: string[];
}) {
  const campusPart = input.appliesToAll
    ? "__ALL__"
    : [...input.campusIds].sort().join("+");
  return [
    input.benefitType,
    input.enrollmentType ?? "__ANY__",
    input.businessLine ?? "__ANY__",
    input.modality ?? "__ANY__",
    normalizeDurationForKey(input.benefitType, input.duration),
    campusPart,
  ].join("|");
}

function hasBenefitValueChanged(
  existing: {
    extraPercent: number;
    firstPaymentAmount: number;
    isActive: boolean;
    notes: string | null;
  },
  row: ParsedBenefitRow,
) {
  return (
    existing.extraPercent !== row.extraPercent ||
    existing.firstPaymentAmount !== row.firstPaymentAmount ||
    existing.isActive !== row.isActive ||
    (existing.notes ?? "") !== (row.notes ?? "")
  );
}

async function buildCampusLookup(
  aliasRows: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  const campuses = await prisma.campus.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      metaKey: true,
      name: true,
      slug: true,
    },
  });
  const lookup = new Map<string, { id: string; label: string }>();
  for (const campus of campuses) {
    const label = campus.name || campus.code || campus.metaKey || campus.slug || campus.id;
    for (const value of [
      campus.id,
      campus.code,
      campus.metaKey,
      campus.name,
      campus.slug,
    ]) {
      lookup.set(value.trim().toLowerCase(), { id: campus.id, label });
    }
  }
  return addConfiguredCampusAliasesToLookup(lookup, aliasRows);
}

async function buildExistingBenefitsByScopeKey() {
  const rows = await prisma.adminAdditionalBenefit.findMany({
    select: {
      id: true,
      benefitType: true,
      enrollmentType: true,
      businessLine: true,
      modality: true,
      duration: true,
      appliesToAll: true,
      campuses: {
        select: { campusId: true },
      },
      extraPercent: true,
      firstPaymentAmount: true,
      isActive: true,
      notes: true,
    },
  });

  const map = new Map<
    string,
    Array<{
      id: string;
      extraPercent: number;
      firstPaymentAmount: number;
      isActive: boolean;
      notes: string | null;
    }>
  >();
  for (const row of rows) {
    const key = buildBenefitScopeKey({
      benefitType: row.benefitType,
      enrollmentType: row.enrollmentType,
      businessLine: row.businessLine,
      modality: row.modality,
      duration: row.duration,
      appliesToAll: row.appliesToAll,
      campusIds: row.campuses.map((campus) => campus.campusId),
    });
    const entry = {
      id: row.id,
      extraPercent: row.extraPercent,
      firstPaymentAmount: Number(row.firstPaymentAmount),
      isActive: row.isActive,
      notes: row.notes,
    };
    const current = map.get(key);
    if (!current) {
      map.set(key, [entry]);
      continue;
    }
    current.push(entry);
  }
  return map;
}

export async function prepareBenefitsCsvImport(
  input: { file: File } & ImporterAliasOptions,
): Promise<BenefitsImportPrepareResult> {
  const text = await input.file.text();
  const rows = parseCsvText(text);
  if (rows.length < 2) {
    throw new Error("El CSV debe contener encabezado y al menos una fila de datos.");
  }

  const header = rows[0] ?? [];
  const headerMap = new Map<string, number>();
  header.forEach((cell, index) => {
    headerMap.set(normalizeHeader(cell), index);
  });

  const idxRegion = findColumnIndex(headerMap, HEADER_ALIASES.region);
  const idxTier = findColumnIndex(headerMap, HEADER_ALIASES.tier);
  const idxBenefitType = findColumnIndex(headerMap, HEADER_ALIASES.benefitType);
  const idxCampusIds = findColumnIndex(headerMap, HEADER_ALIASES.campusIds);
  const idxAppliesToAll = findColumnIndex(headerMap, HEADER_ALIASES.appliesToAll);
  const idxEnrollmentType = findColumnIndex(headerMap, HEADER_ALIASES.enrollmentType);
  const idxBusinessLine = findColumnIndex(headerMap, HEADER_ALIASES.businessLine);
  const idxModality = findColumnIndex(headerMap, HEADER_ALIASES.modality);
  const idxDuration = findColumnIndex(headerMap, HEADER_ALIASES.duration);
  const idxExtraPercent = findColumnIndex(headerMap, HEADER_ALIASES.extraPercent);
  const idxFirstPaymentAmount = findColumnIndex(headerMap, HEADER_ALIASES.firstPaymentAmount);
  const idxIsActive = findColumnIndex(headerMap, HEADER_ALIASES.isActive);
  const idxNotes = findColumnIndex(headerMap, HEADER_ALIASES.notes);

  if (idxBenefitType < 0) {
    throw new Error("Falta columna obligatoria: benefit_type.");
  }
  if (idxCampusIds < 0 && idxAppliesToAll < 0) {
    throw new Error("Falta columna de planteles: campus_ids o applies_to_all.");
  }

  const aliasRows = await loadImporterAliasRows(input);
  const [campusLookup, existingByScope] = await Promise.all([
    buildCampusLookup(aliasRows),
    buildExistingBenefitsByScopeKey(),
  ]);

  const errors: string[] = [];
  const warnings: string[] = [];
  const parsedRows: ParsedBenefitRow[] = [];
  const seenKeys = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (!row.some((cell) => String(cell ?? "").trim())) continue;

    const rowNumber = index + 1;
    const region = readCell(row, idxRegion) || null;
    const tierRaw = canonicalImportText(aliasRows, "tier", readCell(row, idxTier));
    const normalizedTier = normalizeTierWithAliases(tierRaw, aliasRows);
    const tier = normalizedTier === "ANY" ? null : normalizedTier;
    const benefitTypeRaw = readCell(row, idxBenefitType);
    if (!BENEFIT_TYPE_SET.has(benefitTypeRaw as AdminAdditionalBenefitType)) {
      errors.push(`Fila ${rowNumber}: benefit_type inválido "${benefitTypeRaw}".`);
      continue;
    }
    const benefitType = benefitTypeRaw as AdminAdditionalBenefitType;

    const enrollmentTypeRaw = canonicalImportText(aliasRows, "enrollment_type", readCell(row, idxEnrollmentType));
    const enrollmentType = parseOptionalEnum(enrollmentTypeRaw, ENROLLMENT_SET);
    if (enrollmentTypeRaw && enrollmentType === null && enrollmentTypeRaw !== "__ALL__") {
      errors.push(`Fila ${rowNumber}: enrollment_type inválido "${enrollmentTypeRaw}".`);
      continue;
    }

    const businessLineRaw = canonicalImportText(aliasRows, "business_line", readCell(row, idxBusinessLine));
    const businessLine = parseOptionalEnum(businessLineRaw, BUSINESS_LINE_SET);
    if (businessLineRaw && businessLine === null && businessLineRaw !== "__ALL__") {
      errors.push(`Fila ${rowNumber}: business_line inválido "${businessLineRaw}".`);
      continue;
    }

    const modalityRaw = canonicalImportText(aliasRows, "modality", readCell(row, idxModality));
    const modality = parseOptionalEnum(modalityRaw, MODALITY_SET);
    if (modalityRaw && modality === null && modalityRaw !== "__ALL__") {
      errors.push(`Fila ${rowNumber}: modality inválido "${modalityRaw}".`);
      continue;
    }

    const durationRaw = readCell(row, idxDuration);
    let duration = parseOptionalEnum(durationRaw, DURATION_SET);
    if (durationRaw && duration === null && durationRaw !== "__ALL__") {
      errors.push(`Fila ${rowNumber}: duration inválido "${durationRaw}".`);
      continue;
    }

    const appliesToAll = parseBoolean(readCell(row, idxAppliesToAll), false);
    const campusIdentifiers = parseCampusIdentifiers(readCell(row, idxCampusIds));
    const campusIds: string[] = [];
    const campusLabels: string[] = [];
    if (!appliesToAll) {
      if (!campusIdentifiers.length) {
        errors.push(`Fila ${rowNumber}: campus_ids es obligatorio cuando applies_to_all=false.`);
        continue;
      }
      let hasCampusError = false;
      for (const campusIdentifier of campusIdentifiers) {
        const normalizedIdentifier = campusIdentifier.trim().toLowerCase();
        const campus =
          campusLookup.get(normalizedIdentifier) ??
          campusLookup.get(canonicalImportKey(aliasRows, "campus", campusIdentifier));
        if (!campus) {
          errors.push(`Fila ${rowNumber}: plantel no reconocido "${campusIdentifier}".`);
          hasCampusError = true;
          continue;
        }
        campusIds.push(campus.id);
        campusLabels.push(campus.label);
      }
      if (hasCampusError) continue;
    }

    const isActive = parseBoolean(readCell(row, idxIsActive), true);
    const notes = readCell(row, idxNotes) || null;

    const extraPercentRaw = readCell(row, idxExtraPercent);
    const firstPaymentAmountRaw = readCell(row, idxFirstPaymentAmount);
    const extraPercent = extraPercentRaw ? Number(extraPercentRaw) : 0;
    const firstPaymentAmount = firstPaymentAmountRaw ? Number(firstPaymentAmountRaw) : 0;

    if (benefitType === AdminAdditionalBenefitType.percentage) {
      if (!Number.isFinite(extraPercent) || extraPercent <= 0 || extraPercent > 100) {
        errors.push(`Fila ${rowNumber}: extra_percent debe estar entre 1 y 100.`);
        continue;
      }
      if (extraPercent % 5 !== 0) {
        errors.push(`Fila ${rowNumber}: extra_percent debe ser múltiplo de 5.`);
        continue;
      }
      if (firstPaymentAmountRaw && Number(firstPaymentAmountRaw) !== 0) {
        warnings.push(
          `Fila ${rowNumber}: first_payment_amount se ignoró porque benefit_type=percentage.`,
        );
      }
    } else {
      if (!Number.isFinite(firstPaymentAmount) || firstPaymentAmount <= 0) {
        errors.push(`Fila ${rowNumber}: first_payment_amount debe ser mayor a 0.`);
        continue;
      }
      if (extraPercentRaw && Number(extraPercentRaw) !== 0) {
        warnings.push(`Fila ${rowNumber}: extra_percent se ignoró porque benefit_type=first_payment.`);
      }
      duration = BenefitDuration.pago_inicial;
    }

    const normalizedCampusIds = appliesToAll ? [] : Array.from(new Set(campusIds)).sort();
    const normalizedCampusLabels = appliesToAll
      ? []
      : Array.from(new Set(campusLabels)).sort((left, right) =>
          left.localeCompare(right, "es-MX", { sensitivity: "base" }),
        );
    const key = buildBenefitScopeKey({
      benefitType,
      enrollmentType,
      businessLine,
      modality,
      duration,
      appliesToAll,
      campusIds: normalizedCampusIds,
    });

    if (seenKeys.has(key)) {
      errors.push(`Fila ${rowNumber}: scope duplicado dentro del CSV.`);
      continue;
    }
    seenKeys.add(key);

    const parsedRow: ParsedBenefitRow = {
      rowNumber,
      region,
      tier,
      benefitType,
      enrollmentType,
      businessLine,
      modality,
      duration,
      appliesToAll,
      campusIds: normalizedCampusIds,
      campusLabels: normalizedCampusLabels,
      extraPercent: benefitType === AdminAdditionalBenefitType.percentage ? extraPercent : 0,
      firstPaymentAmount:
        benefitType === AdminAdditionalBenefitType.first_payment ? firstPaymentAmount : 0,
      isActive,
      notes,
    };
    parsedRows.push(parsedRow);
  }

  const payloadRows: PreparedBenefitsImportPayloadRow[] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const parsedRow of parsedRows) {
    const key = buildBenefitScopeKey({
      benefitType: parsedRow.benefitType,
      enrollmentType: parsedRow.enrollmentType,
      businessLine: parsedRow.businessLine,
      modality: parsedRow.modality,
      duration: parsedRow.duration,
      appliesToAll: parsedRow.appliesToAll,
      campusIds: parsedRow.campusIds,
    });
    const matches = existingByScope.get(key) ?? [];
    if (matches.length > 1) {
      warnings.push(
        `Fila ${parsedRow.rowNumber}: hay ${matches.length} beneficios existentes con el mismo scope.`,
      );
    }
    const existing = matches[0] ?? null;
    const action: BenefitImportDiffAction = !existing
      ? "create"
      : hasBenefitValueChanged(existing, parsedRow)
      ? "update"
      : "noop";
    if (action === "create") created += 1;
    else if (action === "update") updated += 1;
    else unchanged += 1;

    payloadRows.push({
      ...parsedRow,
      key,
      existingId: existing?.id ?? null,
      action,
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
    payload: {
      rows: payloadRows,
    },
  };
}

export async function applyPreparedBenefitsImport(params: {
  payload: PreparedBenefitsImportPayload;
  updatedBy: string;
}): Promise<BenefitsImportApplySummary> {
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
        appliesToAll: row.appliesToAll,
        benefitType: row.benefitType,
        enrollmentType: row.enrollmentType,
        extraPercent: row.extraPercent,
        firstPaymentAmount: row.firstPaymentAmount,
        isActive: row.isActive,
        notes: row.notes,
        businessLine: row.businessLine,
        modality: row.modality,
        duration: row.duration,
        updatedBy: params.updatedBy,
      };

      let benefitId = row.existingId ?? null;
      if (benefitId) {
        const exists = await tx.adminAdditionalBenefit.findUnique({
          where: { id: benefitId },
          select: { id: true },
        });
        if (exists) {
          await tx.adminAdditionalBenefit.update({
            where: { id: benefitId },
            data,
          });
          updated += 1;
        } else {
          benefitId = null;
        }
      }

      if (!benefitId) {
        const createdBenefit = await tx.adminAdditionalBenefit.create({
          data,
          select: { id: true },
        });
        benefitId = createdBenefit.id;
        created += 1;
      }

      await tx.adminAdditionalBenefitCampus.deleteMany({
        where: { benefitId },
      });
      if (!row.appliesToAll && row.campusIds.length) {
        await tx.adminAdditionalBenefitCampus.createMany({
          data: row.campusIds.map((campusId) => ({
            benefitId,
            campusId,
          })),
        });
      }
    }
  });

  return {
    processed: rows.length,
    created,
    updated,
    unchanged,
  };
}
