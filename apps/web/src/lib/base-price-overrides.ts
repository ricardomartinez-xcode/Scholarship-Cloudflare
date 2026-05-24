import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";
import {
  toNumber,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
  type EnrollmentTypeValue,
} from "@/lib/pricing-normalize";

export const BASE_PRICE_OVERRIDE_SCOPE = "base_price";
export const LEGACY_DISCOUNTED_PRICE_OVERRIDE_SCOPE = "monto";

function toLegacyBusinessLine(businessLine: CanonicalBusinessLine | string) {
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
  const expectedNivel = toLegacyBusinessLine(params.businessLine);
  const expectedTier = normalizeTierKey(params.tier);
  const targetNivel = normalizeKey(keys.nivel_key ?? keys.businessLine ?? keys.nivel);
  const targetModality = normalizeKey(
    keys.modalidad_key ?? keys.modality ?? keys.modalidad,
  );
  const targetPlan = normalizeKey(keys.plan);
  const targetTier = normalizeTierKey(keys.tier);

  return (
    targetNivel === normalizeKey(expectedNivel) &&
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

function matchesLegacyDiscountedTarget(
  keys: Record<string, unknown>,
  params: {
    enrollmentType: EnrollmentTypeValue;
    businessLine: CanonicalBusinessLine | string;
    modality: CanonicalModalityValue | string;
    plan: number | string;
    tier?: string | null;
  },
) {
  const legacyEnrollment =
    params.enrollmentType === "nuevo_ingreso" ? "nuevo_ingreso" : "reingreso";
  return (
    normalizeKey(keys.programa_key) === legacyEnrollment &&
    matchesBasePriceTarget(keys, params)
  );
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

export function buildLegacyDiscountedOverrideMap(
  overrides: PriceOverrideSnapshot[],
) {
  const map = new Map<string, number>();
  for (const override of overrides) {
    if (!override.isActive || override.scope !== LEGACY_DISCOUNTED_PRICE_OVERRIDE_SCOPE) {
      continue;
    }
    const keys = targetRecord(override.targetKeys);
    const key = [
      normalizeKey(keys.programa_key),
      normalizeKey(keys.nivel_key),
      normalizeKey(keys.modalidad_key),
      normalizeKey(keys.plan),
      normalizeTierKey(keys.tier),
    ].join("|");
    const price = toNumber(override.newPrice);
    if (price !== null) map.set(key, price);
  }
  return map;
}

export function legacyDiscountedOverrideKey(params: {
  enrollmentType: EnrollmentTypeValue | string;
  businessLine: CanonicalBusinessLine | string;
  modality: CanonicalModalityValue | string;
  plan: number | string;
  tier?: string | null;
}) {
  const legacyEnrollment =
    params.enrollmentType === "nuevo_ingreso" ? "nuevo_ingreso" : "reingreso";
  return [
    legacyEnrollment,
    normalizeKey(toLegacyBusinessLine(params.businessLine)),
    normalizeKey(params.modality),
    normalizeKey(params.plan),
    normalizeTierKey(params.tier),
  ].join("|");
}

export function findLegacyDiscountedPriceOverride(
  overrides: PriceOverrideSnapshot[],
  params: {
    enrollmentType: EnrollmentTypeValue;
    businessLine: CanonicalBusinessLine | string;
    modality: CanonicalModalityValue | string;
    plan: number | string;
    tier?: string | null;
  },
) {
  for (const override of overrides) {
    if (!override.isActive || override.scope !== LEGACY_DISCOUNTED_PRICE_OVERRIDE_SCOPE) {
      continue;
    }
    if (matchesLegacyDiscountedTarget(targetRecord(override.targetKeys), params)) {
      const price = toNumber(override.newPrice);
      if (price !== null) return price;
    }
  }
  return null;
}
