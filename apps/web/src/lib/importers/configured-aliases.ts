import type {
  CanonicalAliasRuntimeRow,
  CanonicalAliasType,
} from "@/lib/admin-canonical-aliases";
import {
  normalizeAliasKey,
  normalizeAliasText,
  resolveConfiguredAlias,
} from "@/lib/admin-canonical-aliases";
import { getActiveCanonicalAliasRows } from "@/lib/configured-canonical-aliases";

export type ImporterAliasOptions = {
  aliasRows?: CanonicalAliasRuntimeRow[];
};

export async function loadImporterAliasRows(
  options?: ImporterAliasOptions,
): Promise<CanonicalAliasRuntimeRow[]> {
  if (options?.aliasRows) return options.aliasRows;

  try {
    return await getActiveCanonicalAliasRows();
  } catch {
    return [];
  }
}

export function resolveImporterCanonicalAlias(
  rows: CanonicalAliasRuntimeRow[],
  aliasType: CanonicalAliasType,
  value: string | null | undefined,
) {
  return resolveConfiguredAlias(rows, aliasType, value);
}

export function canonicalImportText(
  rows: CanonicalAliasRuntimeRow[],
  aliasType: CanonicalAliasType,
  value: string | null | undefined,
) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return resolveImporterCanonicalAlias(rows, aliasType, trimmed) ?? trimmed;
}

export function canonicalImportKey(
  rows: CanonicalAliasRuntimeRow[],
  aliasType: CanonicalAliasType,
  value: string | null | undefined,
) {
  return normalizeAliasKey(canonicalImportText(rows, aliasType, value));
}

export function addConfiguredCampusAliasesToLookup<T>(
  lookup: Map<string, T>,
  rows: CanonicalAliasRuntimeRow[],
) {
  for (const [key, value] of Array.from(lookup.entries())) {
    const normalizedKey = normalizeAliasKey(key);
    const normalizedText = normalizeAliasText(key);
    if (normalizedKey) lookup.set(normalizedKey, value);
    if (normalizedText) lookup.set(normalizedText, value);
  }

  for (const row of rows) {
    if (!row.isActive || row.aliasType !== "campus") continue;
    const target =
      lookup.get(row.canonicalNormalized) ??
      lookup.get(normalizeAliasText(row.canonicalValue)) ??
      lookup.get(normalizeAliasKey(row.canonicalValue));

    if (!target) continue;

    lookup.set(row.aliasNormalized, target);
    lookup.set(normalizeAliasText(row.aliasValue), target);
  }

  return lookup;
}
