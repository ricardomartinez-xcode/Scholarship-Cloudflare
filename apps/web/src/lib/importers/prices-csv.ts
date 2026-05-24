import { Prisma } from "@prisma/client";

import { parseCsvText, normalizeHeader } from "@/lib/importers/csv-utils";
import { prisma } from "@/lib/prisma";

export type PriceImportDiffAction = "create" | "update" | "noop";

export type PriceImportPreviewRow = {
  rowNumber: number;
  action: PriceImportDiffAction;
  plantel: string | null;
  programaKey: string | null;
  nivelKey: string;
  modalidadKey: string;
  plan: string;
  tier: string | null;
  newPrice: number;
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

type ParsedPriceRow = {
  rowNumber: number;
  plantel: string | null;
  programaKey: string | null;
  nivelKey: string;
  modalidadKey: string;
  plan: string;
  tier: string | null;
  newPrice: number;
  isActive: boolean;
  notes: string | null;
};

const HEADER_ALIASES = {
  programaKey: ["programakey", "programa", "programa_key"],
  plantel: ["plantel", "campus", "sede"],
  nivelKey: ["nivelkey", "nivel", "nivel_key"],
  modalidadKey: ["modalidadkey", "modalidad", "modalidad_key"],
  plan: ["plan"],
  tier: ["tier"],
  newPrice: ["newprice", "precio", "preciolista", "monto", "new_price"],
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

function parseBoolean(value: string, defaultValue: boolean) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "si", "sí", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

function buildPriceScopeKey(input: {
  plantel?: string | null;
  programaKey?: string | null;
  nivelKey: string;
  modalidadKey: string;
  plan: string;
  tier: string | null;
}) {
  return [
    (input.plantel ?? "").trim().toLowerCase(),
    (input.programaKey ?? "").trim().toLowerCase(),
    input.nivelKey.trim().toLowerCase(),
    input.modalidadKey.trim().toLowerCase(),
    input.plan.trim().toLowerCase(),
    (input.tier ?? "").trim().toLowerCase(),
  ].join("|");
}

function hasPriceValueChanged(
  existing: {
    newPrice: number;
    isActive: boolean;
    notes: string | null;
  },
  row: ParsedPriceRow,
) {
  return (
    existing.newPrice !== row.newPrice ||
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
      programaKey: String(target.programa_key ?? ""),
      nivelKey: String(target.nivel_key ?? ""),
      modalidadKey: String(target.modalidad_key ?? ""),
      plan: String(target.plan ?? ""),
      tier: target.tier ? String(target.tier) : null,
    });
    const entry = {
      id: row.id,
      newPrice: Number(row.newPrice),
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
  input: { file: File },
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

  const idxPrograma = findColumnIndex(headerMap, HEADER_ALIASES.programaKey);
  const idxPlantel = findColumnIndex(headerMap, HEADER_ALIASES.plantel);
  const idxNivel = findColumnIndex(headerMap, HEADER_ALIASES.nivelKey);
  const idxModalidad = findColumnIndex(headerMap, HEADER_ALIASES.modalidadKey);
  const idxPlan = findColumnIndex(headerMap, HEADER_ALIASES.plan);
  const idxTier = findColumnIndex(headerMap, HEADER_ALIASES.tier);
  const idxNewPrice = findColumnIndex(headerMap, HEADER_ALIASES.newPrice);
  const idxIsActive = findColumnIndex(headerMap, HEADER_ALIASES.isActive);
  const idxNotes = findColumnIndex(headerMap, HEADER_ALIASES.notes);

  if (idxNivel < 0 || idxModalidad < 0 || idxPlan < 0 || idxNewPrice < 0) {
    throw new Error(
      "Faltan columnas obligatorias: nivel_key, modalidad_key, plan, new_price.",
    );
  }

  const existingByScope = await buildExistingPriceOverridesByScopeKey();

  const errors: string[] = [];
  const warnings: string[] = [];
  const parsedRows: ParsedPriceRow[] = [];
  const seenKeys = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (!row.some((cell) => String(cell ?? "").trim())) continue;
    const rowNumber = index + 1;

    const plantel = readCell(row, idxPlantel) || null;
    const programaKey = readCell(row, idxPrograma) || null;
    const nivelKey = readCell(row, idxNivel);
    const modalidadKey = readCell(row, idxModalidad);
    const plan = readCell(row, idxPlan);
    const tier = readCell(row, idxTier) || null;

    if (!nivelKey || !modalidadKey || !plan) {
      errors.push(
        `Fila ${rowNumber}: nivel_key, modalidad_key y plan son obligatorios.`,
      );
      continue;
    }

    const newPriceRaw = readCell(row, idxNewPrice);
    const newPrice = Number(newPriceRaw);
    if (!newPriceRaw || !Number.isFinite(newPrice) || newPrice < 0) {
      errors.push(`Fila ${rowNumber}: new_price debe ser numérico y no negativo.`);
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
      tier,
    });
    if (seenKeys.has(key)) {
      errors.push(`Fila ${rowNumber}: scope duplicado dentro del CSV.`);
      continue;
    }
    seenKeys.add(key);

    parsedRows.push({
      rowNumber,
      plantel,
      programaKey,
      nivelKey,
      modalidadKey,
      plan,
      tier,
      newPrice,
      isActive,
      notes,
    });
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
}): Promise<PricesImportApplySummary> {
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

      const targetKeys: Record<string, string | null> = {
        nivel_key: row.nivelKey,
        modalidad_key: row.modalidadKey,
        plan: row.plan,
        tier: row.tier,
      };
      if (row.programaKey) {
        targetKeys.programa_key = row.programaKey;
      }
      if (row.plantel) {
        targetKeys.plantel = row.plantel;
      }

      let existingId = row.existingId ?? null;
      if (existingId) {
        const exists = await tx.adminPriceOverride.findUnique({
          where: { id: existingId },
          select: { id: true },
        });
        if (exists) {
          await tx.adminPriceOverride.update({
            where: { id: existingId },
            data: {
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
