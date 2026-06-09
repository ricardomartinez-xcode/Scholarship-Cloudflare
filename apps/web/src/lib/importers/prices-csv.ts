import { Prisma } from "@prisma/client";

import { parseCsvText, normalizeHeader } from "@/lib/importers/csv-utils";
import {
  canonicalImportKey,
  canonicalImportText,
  loadImporterAliasRows,
  type ImporterAliasOptions,
} from "@/lib/importers/configured-aliases";
import {
  normalizeBusinessLineWithAliases,
  normalizeCanonicalModalityWithAliases,
  normalizeTierWithAliases,
} from "@/lib/pricing-normalize";
import { academicModuleOrDefault, type AcademicModule } from "@/lib/academic-modules";
import {
  adminPriceScopeDefinition,
  adminPriceScopeRequiresField,
  formatAdminPriceScopePreset,
  inferAdminPriceScopePreset,
  normalizeAdminPriceScopePreset,
  type AdminPriceScopePreset,
} from "@/lib/admin-price-scope";
import { prisma } from "@/lib/prisma";

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

function parseBoolean(value: string, defaultValue: boolean) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "si", "sí", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

function parseMoney(value: string) {
  const normalized = value.replace(/[$\s]/g, "").replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeNivelKey(
  value: string,
  aliases: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  const configured = normalizeBusinessLineWithAliases(value, aliases);
  if (configured === "prepa") return "preparatoria";
  if (configured === "posgrado") return "maestria";
  if (configured) return configured;

  const key = normalizeText(value);
  if (key.includes("bachiller") || key.includes("prepa")) return "preparatoria";
  if (key.includes("licenciatura") || key.includes("lic")) return "licenciatura";
  if (key.includes("salud")) return "salud";
  if (key.includes("posgrado") || key.includes("maestria") || key.includes("maestr")) {
    return "maestria";
  }
  return value.trim().toLowerCase();
}

function normalizeModalidadKey(
  value: string,
  aliases: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  const configured = normalizeCanonicalModalityWithAliases(value, aliases);
  if (configured) return configured;

  const key = normalizeText(value);
  if (key.includes("online")) return "online";
  if (key.includes("ejecut") || key.includes("mixta")) return "mixta";
  if (key.includes("escolar") || key.includes("presencial")) return "presencial";
  return value.trim().toLowerCase();
}

function normalizeTierKey(
  value: string,
  aliases: Awaited<ReturnType<typeof loadImporterAliasRows>>,
) {
  const raw = normalizeTierWithAliases(
    canonicalImportText(aliases, "tier", value),
    aliases,
  ).trim().toUpperCase();
  if (!raw || raw === "ANY" || raw === "GENERAL" || raw === "ONLINE" || raw === "OL") {
    return null;
  }
  const match = raw.match(/(?:TIER|T)\s*([0-9]+)/);
  return match ? `T${match[1]}` : raw;
}

function normalizePlan(value: string) {
  const match = value.trim().match(/[0-9]+/);
  return match?.[0] ?? value.trim();
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
      subjectPrice: parseMoney(
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
  const rows = parseCsvText(text);
  if (rows.length < 2) {
    throw new Error("El CSV debe contener encabezado y al menos una fila de datos.");
  }

  const header = rows[0] ?? [];
  const headerMap = new Map<string, number>();
  header.forEach((cell, index) => {
    headerMap.set(normalizeHeader(cell), index);
  });

  const detectedHeaders = header.map((cell) => String(cell ?? "").trim()).filter(Boolean);
  const idxPrograma = findColumnIndex(headerMap, HEADER_ALIASES.programaKey);
  const idxScopePreset = findColumnIndex(headerMap, HEADER_ALIASES.scopePreset);
  const idxRegion = findColumnIndex(headerMap, HEADER_ALIASES.region);
  const idxPlantel = findColumnIndex(headerMap, HEADER_ALIASES.plantel);
  const idxNivel = findColumnIndex(headerMap, HEADER_ALIASES.nivelKey);
  const idxModalidad = findColumnIndex(headerMap, HEADER_ALIASES.modalidadKey);
  const idxPlan = findColumnIndex(headerMap, HEADER_ALIASES.plan);
  const idxModule = findColumnIndex(headerMap, HEADER_ALIASES.module);
  const idxTier = findColumnIndex(headerMap, HEADER_ALIASES.tier);
  const idxNewPrice = findColumnIndex(headerMap, HEADER_ALIASES.newPrice);
  const idxSubjectPrice = findColumnIndex(headerMap, HEADER_ALIASES.subjectPrice);
  const idxIsActive = findColumnIndex(headerMap, HEADER_ALIASES.isActive);
  const idxNotes = findColumnIndex(headerMap, HEADER_ALIASES.notes);

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

    const plantelRaw = readCell(row, idxPlantel);
    const plantel = plantelRaw ? canonicalImportText(aliasRows, "campus", plantelRaw) : null;
    const region = readCell(row, idxRegion) || null;
    const programaKey = normalizeProgramaKey(readCell(row, idxPrograma) || null, aliasRows);
    const nivelKey = normalizeNivelKey(readCell(row, idxNivel), aliasRows);
    const modalidadKey = normalizeModalidadKey(readCell(row, idxModalidad), aliasRows);
    const plan = normalizePlan(readCell(row, idxPlan));
    const academicModule = academicModuleOrDefault(readCell(row, idxModule));
    const tier = normalizeTierKey(readCell(row, idxTier), aliasRows);
    const explicitScopePreset = normalizeAdminPriceScopePreset(readCell(row, idxScopePreset));
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

    const newPriceRaw = readCell(row, idxNewPrice);
    const newPrice = parseMoney(newPriceRaw);
    if (!newPriceRaw || newPrice === null) {
      errors.push(`Fila ${rowNumber}: precio debe ser numérico y no negativo.`);
      continue;
    }
    const subjectPriceRaw = readCell(row, idxSubjectPrice);
    const subjectPrice = subjectPriceRaw ? parseMoney(subjectPriceRaw) : null;
    if (subjectPriceRaw && subjectPrice === null) {
      errors.push(`Fila ${rowNumber}: precio_por_materia debe ser numérico y no negativo.`);
      continue;
    }

    const isActive = parseBoolean(readCell(row, idxIsActive), true);
    const notes = readCell(row, idxNotes) || null;
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

  await prisma.$transaction(async (tx) => {
    if (mode === "replace") {
      await tx.adminPriceOverride.deleteMany({ where: { scope: "base_price" } });
    }

    for (const row of rows) {
      if (mode === "update-only" && row.action === "create") {
        throw new PricesCsvValidationError(
          `Actualizar lote no puede crear precios nuevos. Revisa la fila ${row.rowNumber}.`,
          "UPDATE_ONLY_CANNOT_CREATE_PRICE",
        );
      }

      if (row.action === "noop" && mode !== "replace") {
        unchanged += 1;
        continue;
      }

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
              targetKeys: targetKeys as Prisma.InputJsonValue,
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
          scope: "base_price",
          targetKeys: targetKeys as Prisma.InputJsonValue,
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
