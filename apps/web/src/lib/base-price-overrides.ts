import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";
import {
  toNumber,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
} from "@/lib/pricing-normalize";

export const BASE_PRICE_OVERRIDE_SCOPE = "base_price";

function toHistoricalBusinessLineKey(businessLine: CanonicalBusinessLine | string) {
  if (businessLine === "prepa") return "preparatoria";
  if (businessLine === "posgrado") return "maestria";
  return String(businessLine);
}

function normalizeKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeTierKey(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.toUpperCase() === "ANY") return "";
  if (raw.toUpperCase() === "ONLINE") return "";
  return raw.toUpperCase();
}

function targetRecord(targetKeys: unknown) {
  return targetKeys && typeof targetKeys === "object"
    ? (targetKeys as Record<string, unknown>)
    : {};
}

function matchesBasePriceTarget(
  keys: Record<string, unknown>,
  params: {
    businessLine: CanonicalBusinessLine | string;
    modality: CanonicalModalityValue | string;
    plan: number | string;
    tier?: string | null;
  },
) {
  const expectedBusinessLineKey = toHistoricalBusinessLineKey(params.businessLine);
  const expectedTier = normalizeTierKey(params.tier);
  const targetNivel = normalizeKey(keys.nivel_key ?? keys.businessLine ?? keys.nivel);
  const targetModality = normalizeKey(
    keys.modalidad_key ?? keys.modality ?? keys.modalidad,
  );
  const targetPlan = normalizeKey(keys.plan);
  const targetTier = normalizeTierKey(keys.tier);

  return (
    targetNivel === normalizeKey(expectedBusinessLineKey) &&
    targetModality === normalizeKey(params.modality) &&
    targetPlan === normalizeKey(params.plan) &&
    targetTier === expectedTier
  );
}

function normalizeCampusTargets(params: {
  campus?: string | null;
  campusAliases?: string[];
}) {
  return new Set(
    [params.campus, ...(params.campusAliases ?? [])]
      .map((value) => normalizeKey(value))
      .filter(Boolean),
  );
}

function targetCampusKey(keys: Record<string, unknown>) {
  return normalizeKey(keys.plantel ?? keys.campus ?? keys.sede ?? keys.metaKey);
}

export function findPublishedBasePriceOverride(
  overrides: PriceOverrideSnapshot[],
  params: {
    businessLine: CanonicalBusinessLine | string;
    modality: CanonicalModalityValue | string;
    plan: number | string;
    tier?: string | null;
    campus?: string | null;
    campusAliases?: string[];
  },
) {
  const campusTargets = normalizeCampusTargets(params);
  let genericPrice: number | null = null;

  for (const override of overrides) {
    if (!override.isActive || override.scope !== BASE_PRICE_OVERRIDE_SCOPE) continue;
    const keys = targetRecord(override.targetKeys);
    if (!matchesBasePriceTarget(keys, params)) continue;

    const price = toNumber(override.newPrice);
    if (price === null) continue;

    const campusKey = targetCampusKey(keys);
    if (campusKey) {
      if (campusTargets.has(campusKey)) return price;
      continue;
    }

    if (genericPrice === null) genericPrice = price;
  }

  return genericPrice;
}
