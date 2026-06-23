import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";
import { BASE_PRICE_OVERRIDE_SCOPE } from "@/lib/base-price-overrides";
import { mergePriceOverrideLayers } from "@/lib/published-price-overrides";

export type PriceImportCoverageMode = "replace" | "update-only";

export type PriceImportCoverageRow = {
  rowNumber: number;
  action: "create" | "update" | "noop";
  existingId: string | null;
  scope: string;
  targetKeys: PriceOverrideSnapshot["targetKeys"];
  newPrice: number;
  isActive: boolean;
  notes: string | null;
  updatedBy: string | null;
};

export class PriceImportProjectionError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "PriceImportProjectionError";
    this.code = code;
  }
}

function cloneOverride(override: PriceOverrideSnapshot): PriceOverrideSnapshot {
  return {
    ...override,
    targetKeys: JSON.parse(
      JSON.stringify(override.targetKeys),
    ) as PriceOverrideSnapshot["targetKeys"],
  };
}

function toProjectedOverride(
  row: PriceImportCoverageRow,
  id: string,
): PriceOverrideSnapshot {
  return {
    id,
    scope: row.scope,
    targetKeys: JSON.parse(
      JSON.stringify(row.targetKeys),
    ) as PriceOverrideSnapshot["targetKeys"],
    newPrice: row.newPrice,
    isActive: row.isActive,
    notes: row.notes,
    updatedBy: row.updatedBy,
  };
}

export function projectLivePriceOverrides(params: {
  currentLiveOverrides: PriceOverrideSnapshot[];
  rows: PriceImportCoverageRow[];
  mode: PriceImportCoverageMode;
}): PriceOverrideSnapshot[] {
  if (params.mode === "replace") {
    return [
      ...params.currentLiveOverrides
        .filter((override) => override.scope !== BASE_PRICE_OVERRIDE_SCOPE)
        .map(cloneOverride),
      ...params.rows.map((row) =>
        toProjectedOverride(row, `imported:${row.rowNumber}`),
      ),
    ];
  }

  const projected = new Map(
    params.currentLiveOverrides.map((override) => [
      override.id,
      cloneOverride(override),
    ]),
  );

  for (const row of params.rows) {
    if (row.action === "create") {
      throw new PriceImportProjectionError(
        `Actualizar lote no puede crear precios nuevos. Revisa la fila ${row.rowNumber}.`,
        "UPDATE_ONLY_CANNOT_CREATE_PRICE",
      );
    }

    if (row.action === "noop") continue;

    if (!row.existingId) {
      throw new PriceImportProjectionError(
        `La fila ${row.rowNumber} no tiene un override existente para actualizar.`,
        "UPDATE_ONLY_MISSING_EXISTING_PRICE",
      );
    }

    projected.set(
      row.existingId,
      toProjectedOverride(row, row.existingId),
    );
  }

  return Array.from(projected.values());
}

export function projectEffectivePriceOverrides(params: {
  publishedOverrides: PriceOverrideSnapshot[];
  currentLiveOverrides: PriceOverrideSnapshot[];
  rows: PriceImportCoverageRow[];
  mode: PriceImportCoverageMode;
}) {
  const liveOverrides = projectLivePriceOverrides({
    currentLiveOverrides: params.currentLiveOverrides,
    rows: params.rows,
    mode: params.mode,
  });

  return mergePriceOverrideLayers(
    params.publishedOverrides,
    liveOverrides,
  );
}
