export const CANONICAL_ALIAS_TYPES = [
  "business_line",
  "modality",
  "enrollment_type",
  "program",
  "campus",
  "tier",
] as const;

export type CanonicalAliasType = (typeof CANONICAL_ALIAS_TYPES)[number];

export const CANONICAL_ALIAS_TYPE_LABELS: Record<CanonicalAliasType, string> = {
  business_line: "Línea de negocio",
  modality: "Modalidad",
  enrollment_type: "Tipo de ingreso",
  program: "Programa",
  campus: "Plantel",
  tier: "Tier",
};

export function normalizeAliasText(raw: string | null | undefined) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAliasKey(raw: string | null | undefined) {
  return normalizeAliasText(raw)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isCanonicalAliasType(value: string): value is CanonicalAliasType {
  return CANONICAL_ALIAS_TYPES.includes(value as CanonicalAliasType);
}

export type CanonicalAliasInput = {
  aliasType: CanonicalAliasType;
  canonicalValue: string;
  aliasValue: string;
  isActive?: boolean;
  notes?: string | null;
};

export type CanonicalAliasRuntimeRow = {
  aliasType: string;
  canonicalValue: string;
  canonicalNormalized: string;
  aliasValue: string;
  aliasNormalized: string;
  isActive: boolean;
};

export function resolveConfiguredAlias(
  rows: CanonicalAliasRuntimeRow[],
  aliasType: CanonicalAliasType,
  value: string | null | undefined,
) {
  const normalized = normalizeAliasKey(value);
  if (!normalized) return null;

  const match = rows.find(
    (row) =>
      row.isActive &&
      row.aliasType === aliasType &&
      row.aliasNormalized === normalized,
  );

  return match?.canonicalNormalized ?? null;
}
