import { Prisma } from "@prisma/client";

import {
  buildImportHeaderMap,
  findImportColumnIndex,
  normalizeImportPlan,
  normalizeLegacyPriceBusinessLineForImport,
  normalizeModalityForImport,
  normalizeTierForImport,
  parseImportBoolean,
  parseImportDelimitedText,
  parseImportNonNegativeMoney,
  readImportCell,
} from "@/lib/importers/global-import-normalization";
import {
  canonicalImportKey,
  canonicalImportText,
  loadImporterAliasRows,
  type ImporterAliasOptions,
} from "@/lib/importers/configured-aliases";
import { academicModuleOrDefault, type AcademicModule } from "@/lib/academic-modules";
import {
  adminPriceScopeDefinition,
  adminPriceScopeRequiresField,
  formatAdminPriceScopePreset,
  inferAdminPriceScopePreset,
  normalizeAdminPriceScopePreset,
  type AdminPriceScopePreset,
} from "@/lib/admin-price-scope";
import { BASE_PRICE_OVERRIDE_SCOPE } from "@/lib/base-price-overrides";
import { listActivePriceCoverageInputs } from "@/lib/importers/price-coverage-report";
import { assertProjectedPriceImportCoverage } from "@/lib/importers/price-import-integrity-guard";
import type { PriceImportCoverageRow } from "@/lib/importers/price-import-coverage-projection";
import { prisma } from "@/lib/prisma";
import { listPriceOverrideLayers } from "@/lib/published-price-overrides";

export type PriceImportDiffAction = "create" | "update" | "noop";

export type PriceImportPreviewRow = {
  rowNumber: number;
  action: PriceImportDiffAction;
  region: string | null;
  plantel: string | null;
  programaKey: string | null;
  scopePreset: AdminPriceScopePreset;
  scopeLabel: string;
  nivelKey: string;
  modalidadKey: string;
  plan: string;
  module: AcademicModule;
  tier: string | null;
  newPrice: number;
  subjectPrice: number | null;
  isActive: boolean;
  notes: string | null;
};

export type PreparedPricesImportPayloadRow = PriceImportPreviewRow & {
  key: string;
  existingId: string | null;
};

export type PreparedPricesImportPayload = {
  rows: PreparedPricesImportPayloadRow[];
};

export type PricesImportPrepareResult = {
  summary: {
    processed: number;
    ready: number;
    created: number;
    updated: number;
    unchanged: number;
    warnings: string[];
    errors: string[];
  };
  previewRows: PriceImportPreviewRow[];
  payload: PreparedPricesImportPayload;
};

export type PricesImportApplySummary = {
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
};

export type PricesImportApplyMode = "replace" | "update-only";

type ParsedPriceRow = {
  rowNumber: number;
  region: string | null;
  plantel: string | null;
  programaKey: string | null;
  scopePreset: AdminPriceScopePreset;
  scopeLabel: string;
  nivelKey: string;
  modalidadKey: string;
  plan: string;
  module: AcademicModule;
  tier: string | null;
  newPrice: number;
  subjectPrice: number | null;
  isActive: boolean;
  notes: string | null;
};

const HEADER_ALIASES = {
  region: ["region", "región"],
  programaKey: ["programakey", "programa", "programa_key"],
  scopePreset: ["alcance", "scope", "scopepreset", "scope_preset", "tipoalcance", "tipo_alcance"],
  plantel: ["plantel", "campus", "sede"],
  nivelKey: [
    "nivelkey",
    "nivel",
    "nivel_key",
    "linea",
    "lineanegocio",
    "lineadenegocio",
    "businessline",
    "business_line",
  ],
  modalidadKey: ["modalidadkey", "modalidad", "modalidad_key"],
  plan: ["plan"],
  module: ["modulo", "módulo", "module"],
  tier: ["tier"],
  newPrice: ["newprice", "precio", "preciolista", "precio_lista", "monto", "new_price"],
  subjectPrice: ["preciopormateria", "precio_por_materia", "precio por materia", "subjectprice", "subject_price_mxn", "pricepersubject"],
  isActive: ["isactive", "activo", "active"],
  notes: ["notes", "nota", "notas"],
} as const;

const REQUIRED_HEADER_EXAMPLE = "linea, modalidad, plan, modulo, precio, precio_por_materia, alcance, programa, plantel, tier";

const LEGACY_PROGRAMA_KEYS = new Set([
  "canonical",
  "canonico",
  "nuevo ingreso",
  "nuevo_ingreso",
  "regreso",
  "reingreso",
]);

export class PricesCsvValidationError extends Error {
  status = 422;
  code: string;

  constructor(message: string, code = "PRICES_CSV_VALIDATION_ERROR") {
    super(message);
    this.name = "PricesCsvValidationError";
    this.code = code;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeProgramaKey(
  value: string | null,
  aliases: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  const key = canonicalImportKey(aliases, "program", value);
  if (!key || LEGACY_PROGRAMA_KEYS.has(key)) return null;
  return key;
}

function normalizeExistingProgramaKey(value: unknown) {
  const key = normalizeText(value);
  if (!key || LEGACY_PROGRAMA_KEYS.has(key)) return null;
  return key;
}

function readProgramaKeyFromTarget(target: Record<string, unknown>) {
  return normalizeExistingProgramaKey(
    target.programa_key ??
      target.programaKey ??
      target.program_key ??
      target.programa ??
      target.program,
  );
}

function normalizeNivelKey(
  value: string,
  aliases: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  return normalizeLegacyPriceBusinessLineForImport(value, aliases);
}

function normalizeModalidadKey(
  value: string,
  aliases: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  return normalizeModalityForImport(value, aliases) ?? value.trim().toLowerCase();
}

function normalizeTierKey(
  value: string,
  aliases: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  return normalizeTierForImport(value, aliases, { nullForAny: true });
}

function buildPriceScopeKey(input: {
  plantel?: string | null;
  programaKey?: string | null;
  nivelKey: string;
  modalidadKey: string;
  plan: string;
  module: AcademicModule;
  tier: string | null;
}) {
  return [
    (input.plantel ?? "").trim().toLowerCase(),
    (input.programaKey ?? "").trim().toLowerCase(),
    input.nivelKey.trim().toLowerCase(),
    input.modalidadKey.trim().toLowerCase(),
    input.plan.trim().toLowerCase(),
    input.module.trim().toLowerCase(),
    (input.tier ?? "").trim().toLowerCase(),
  ].join("|");
}

function hasPriceValueChanged(
  existing: {
    newPrice: number;
    subjectPrice: number | null;
    isActive: boolean;
    notes: string | null;
  },
  row: ParsedPriceRow,
) {
  return (
    existing.newPrice !== row.newPrice ||
    existing.subjectPrice !== row.subjectPrice ||
    existing.isActive !== row.isActive ||
    (existing.notes ?? "") !== (row.notes ?? "")
  );
}

async function buildExistingPriceOverridesByScopeKey() {
  const rows = await prisma.adminPriceOverride.findMany({
    where: { scope: "base_price" },
    select: {
      id: true,
      targetKeys: true,
      newPrice: true,
      isActive: true,
      notes: true,
    },
  });

  const map = new Map<
    string,
    Array<{
      id: string;
      newPrice: number;
      subjectPrice: number | null;
      isActive: boolean;
      notes: string | null;
    }>
  >();
  for (const row of rows) {
    const target =
      row.targetKeys && typeof row.targetKeys === "object"
        ? (row.targetKeys as Record<string, unknown>)
        : {};
    const key = buildPriceScopeKey({
      plantel: target.plantel ? String(target.plantel) : null,
      programaKey: readProgramaKeyFromTarget(target),
      nivelKey: String(target.nivel_key ?? ""),
      modalidadKey: String(target.modalidad_key ?? ""),
      plan: String(target.plan ?? ""),
      module: academicModuleOrDefault(target.modulo ?? target.module ?? target.academicModule),
      tier: target.tier ? String(target.tier) : null,
    });
    const entry = {
      id: row.id,
      newPrice: Number(row.newPrice),
      subjectPrice: parseImportNonNegativeMoney(
        String(
          target.subject_price_mxn ??
            target.precio_por_materia ??
            target.precioPorMateria ??
            "",
        ),
      ),
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

export async function preparePricesCsvImport(
  input: { file: File } & ImporterAliasOptions,
): Promise<PricesImportPrepareResult> {
  const text = await input.file.text();
  const rows = parseImportDelimitedText(text);
  if (rows.length < 2) {
    throw new Error("El CSV debe contener encabezado y al menos una fila de datos.");
  }

  const header = rows[0] ?? [];
  const headerMap = buildImportHeaderMap(header);

  const detectedHeaders = header.map((cell) => String(cell ?? "").trim()).filter(Boolean);
  const idxPrograma = findImportColumnIndex(headerMap, HEADER_ALIASES.programaKey);
  const idxScopePreset = findImportColumnIndex(headerMap, HEADER_ALIASES.scopePreset);
  const idxRegion = findImportColumnIndex(headerMap, HEADER_ALIASES.region);
  const idxPlantel = findImportColumnIndex(headerMap, HEADER_ALIASES.plantel);
  const idxNivel = findImportColumnIndex(headerMap, HEADER_ALIASES.nivelKey);
  const idxModalidad = findImportColumnIndex(headerMap, HEADER_ALIASES.modalidadKey);
  const idxPlan = findImportColumnIndex(headerMap, HEADER_ALIASES.plan);
  const idxModule = findImportColumnIndex(headerMap, HEADER_ALIASES.module);
  const idxTier = findImportColumnIndex(headerMap, HEADER_ALIASES.tier);
  const idxNewPrice = findImportColumnIndex(headerMap, HEADER_ALIASES.newPrice);
  const idxSubjectPrice = findImportColumnIndex(headerMap, HEADER_ALIASES.subjectPrice);
  const idxIsActive = findImportColumnIndex(headerMap, HEADER_ALIASES.isActive);
  const idxNotes = findImportColumnIndex(headerMap, HEADER_ALIASES.notes);

  if (idxNivel < 0 || idxModalidad < 0 || idxPlan < 0 || idxNewPrice < 0) {
    throw new PricesCsvValidationError(
      [
        "Faltan columnas obligatorias.",
        "Columnas obligatorias esperadas: linea, modalidad, plan, precio.",
        `Encabezados detectados: ${detectedHeaders.length ? detectedHeaders.join(", ") : "sin encabezados"}.`,
        `Encabezado válido esperado: ${REQUIRED_HEADER_EXAMPLE}.`,
      ].join(" "),
      "MISSING_REQUIRED_COLUMNS",
    );
  }

  const [existingByScope, aliasRows] = await Promise.all([
    buildExistingPriceOverridesByScopeKey(),
    loadImporterAliasRows(input),
  ]);

  const errors: string[] = [];
  const warnings: string[] = [];
  const parsedRows: ParsedPriceRow[] = [];
  const seenKeys = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (!row.some((cell) => String(cell ?? "").trim())) continue;
    const rowNumber = index + 1;

    const plantelRaw = readImportCell(row, idxPlantel);
    const plantel = plantelRaw ? canonicalImportText(aliasRows, "campus", plantelRaw) : null;
    const region = readImportCell(row, idxRegion) || null;
    const programaKey = normalizeProgramaKey(readImportCell(row, idxPrograma) || null, aliasRows);
    const nivelKey = normalizeNivelKey(readImportCell(row, idxNivel), aliasRows);
    const modalidadKey = normalizeModalidadKey(readImportCell(row, idxModalidad), aliasRows);
    const plan = normalizeImportPlan(readImportCell(row, idxPlan));
    const academicModule = academicModuleOrDefault(readImportCell(row, idxModule));
    const tier = normalizeTierKey(readImportCell(row, idxTier), aliasRows);
    const explicitScopePreset = normalizeAdminPriceScopePreset(readImportCell(row, idxScopePreset));
    const scopePreset = explicitScopePreset ?? inferAdminPriceScopePreset({
      programa_key: programaKey,
      plantel,
      tier,
    });
    const scopeDefinition = adminPriceScopeDefinition(scopePreset);

    if (!nivelKey || !modalidadKey || !plan) {
      errors.push(
        `Fila ${rowNumber}: linea, modalidad y plan son obligatorios.`,
      );
      continue;
    }
    if (explicitScopePreset) {
      if (adminPriceScopeRequiresField(scopePreset, "programa") && !programaKey) {
        errors.push(`Fila ${rowNumber}: el alcance "${scopeDefinition.shortLabel}" requiere programa.`);
        continue;
      }
      if (adminPriceScopeRequiresField(scopePreset, "plantel") && !plantel) {
        errors.push(`Fila ${rowNumber}: el alcance "${scopeDefinition.shortLabel}" requiere plantel.`);
        continue;
      }
      if (adminPriceScopeRequiresField(scopePreset, "tier") && !tier) {
        errors.push(`Fila ${rowNumber}: el alcance "${scopeDefinition.shortLabel}" requiere tier.`);
        continue;
      }
      if (!adminPriceScopeRequiresField(scopePreset, "programa") && programaKey) {
        errors.push(`Fila ${rowNumber}: el alcance "${scopeDefinition.shortLabel}" no permite programa. Usa un alcance de programa o deja la columna programa vacía.`);
        continue;
      }
      if (!adminPriceScopeRequiresField(scopePreset, "plantel") && plantel) {
        errors.push(`Fila ${rowNumber}: el alcance "${scopeDefinition.shortLabel}" no permite plantel. Usa un alcance de plantel o deja la columna plantel vacía.`);
        continue;
      }
      if (!adminPriceScopeRequiresField(scopePreset, "tier") && tier) {
        errors.push(`Fila ${rowNumber}: el alcance "${scopeDefinition.shortLabel}" no permite tier. Usa un alcance por tier o deja la columna tier vacía.`);
        continue;
      }
    }

    const newPriceRaw = readImportCell(row, idxNewPrice);
    const newPrice = parseImportNonNegativeMoney(newPriceRaw);
    if (!newPriceRaw || newPrice === null) {
      errors.push(`Fila ${rowNumber}: precio debe ser numérico y no negativo.`);
      continue;
    }
    const subjectPriceRaw = readImportCell(row, idxSubjectPrice);
    const subjectPrice = subjectPriceRaw ? parseImportNonNegativeMoney(subjectPriceRaw) : null;
    if (subjectPriceRaw && subjectPrice === null) {
      errors.push(`Fila ${rowNumber}: precio_por_materia debe ser numérico y no negativo.`);
      continue;
    }

    const isActive = parseImportBoolean(readImportCell(row, idxIsActive), true);
    const notes = readImportCell(row, idxNotes) || null;
    const key = buildPriceScopeKey({
      plantel,
      programaKey,
      nivelKey,
      modalidadKey,
      plan,
      module: academicModule,
      tier,
    });
    if (seenKeys.has(key)) {
      errors.push(`Fila ${rowNumber}: scope duplicado dentro del CSV.`);
      continue;
    }
    seenKeys.add(key);

    parsedRows.push({
      rowNumber,
      region,
      plantel,
      programaKey,
      scopePreset,
      scopeLabel: formatAdminPriceScopePreset(scopePreset),
      nivelKey,
      modalidadKey,
      plan,
      module: academicModule,
      tier,
      newPrice,
      subjectPrice,
      isActive,
      notes,
    });
  }

  if (errors.length > 0) {
    throw new PricesCsvValidationError(errors.join(" "), "INVALID_PRICE_ROWS");
  }

  if (!parsedRows.length) {
    throw new PricesCsvValidationError(
      `El archivo no contiene filas válidas. Encabezado válido esperado: ${REQUIRED_HEADER_EXAMPLE}.`,
      "NO_VALID_ROWS",
    );
  }

  const payloadRows: PreparedPricesImportPayloadRow[] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const parsedRow of parsedRows) {
    const key = buildPriceScopeKey({
      plantel: parsedRow.plantel,
      programaKey: parsedRow.programaKey,
      nivelKey: parsedRow.nivelKey,
      modalidadKey: parsedRow.modalidadKey,
      plan: parsedRow.plan,
      module: parsedRow.module,
      tier: parsedRow.tier,
    });
    const matches = existingByScope.get(key) ?? [];
    if (matches.length > 1) {
      warnings.push(
        `Fila ${parsedRow.rowNumber}: hay ${matches.length} overrides existentes con el mismo scope.`,
      );
    }
    const existing = matches[0] ?? null;
    const action: PriceImportDiffAction = !existing
      ? "create"
      : hasPriceValueChanged(existing, parsedRow)
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
    previewRows: payloadRows.slice(0, 200),
    payload: { rows: payloadRows },
  };
}

export async function applyPreparedPricesImport(params: {
  payload: PreparedPricesImportPayload;
  updatedBy: string;
  mode?: PricesImportApplyMode;
}): Promise<PricesImportApplySummary> {
  const rows = params.payload.rows ?? [];
  const mode = params.mode ?? "replace";
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  const writes = rows.map((row) => {
    const targetKeys: Record<string, string | number> = {
      ...(row.programaKey ? { programa_key: row.programaKey } : {}),
      nivel_key: row.nivelKey,
      modalidad_key: row.modalidadKey,
      plan: row.plan,
      modulo: row.module,
    };
    if (row.subjectPrice !== null) {
      targetKeys.subject_price_mxn = row.subjectPrice;
    }
    if (row.tier) {
      targetKeys.tier = row.tier;
    }
    if (row.plantel) {
      targetKeys.plantel = row.plantel;
    }
    if (row.region) {
      targetKeys.region = row.region;
    }

    const coverageRow: PriceImportCoverageRow = {
      rowNumber: row.rowNumber,
      action: row.action,
      existingId: row.existingId,
      scope: BASE_PRICE_OVERRIDE_SCOPE,
      targetKeys,
      newPrice: row.newPrice,
      isActive: row.isActive,
      notes: row.notes,
      updatedBy: params.updatedBy,
    };

    return { row, coverageRow };
  });

  await prisma.$transaction(async (tx) => {
    for (const { row } of writes) {
      if (mode === "update-only" && row.action === "create") {
        throw new PricesCsvValidationError(
          `Actualizar lote no puede crear precios nuevos. Revisa la fila ${row.rowNumber}.`,
          "UPDATE_ONLY_CANNOT_CREATE_PRICE",
        );
      }
    }

    const [{ publishedOverrides, liveOverrides }, coverageInputs] =
      await Promise.all([
        listPriceOverrideLayers([BASE_PRICE_OVERRIDE_SCOPE], tx),
        listActivePriceCoverageInputs(null, tx),
      ]);

    assertProjectedPriceImportCoverage({
      coverageInputs,
      publishedOverrides,
      currentLiveOverrides: liveOverrides,
      rows: writes.map(({ coverageRow }) => coverageRow),
      mode,
    });

    if (mode === "replace") {
      await tx.adminPriceOverride.deleteMany({
        where: { scope: BASE_PRICE_OVERRIDE_SCOPE },
      });
    }

    for (const { row, coverageRow } of writes) {
      if (row.action === "noop" && mode !== "replace") {
        unchanged += 1;
        continue;
      }

      let existingId = mode === "replace" ? null : row.existingId ?? null;
      if (existingId) {
        const exists = await tx.adminPriceOverride.findUnique({
          where: { id: existingId },
          select: { id: true },
        });
        if (exists) {
          await tx.adminPriceOverride.update({
            where: { id: existingId },
            data: {
              targetKeys: coverageRow.targetKeys as Prisma.InputJsonValue,
              newPrice: row.newPrice,
              isActive: row.isActive,
              notes: row.notes,
              updatedBy: params.updatedBy,
            },
          });
          updated += 1;
          continue;
        }
        existingId = null;
      }

      await tx.adminPriceOverride.create({
        data: {
          scope: BASE_PRICE_OVERRIDE_SCOPE,
          targetKeys: coverageRow.targetKeys as Prisma.InputJsonValue,
          newPrice: row.newPrice,
          isActive: row.isActive,
          notes: row.notes,
          updatedBy: params.updatedBy,
        },
      });
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
