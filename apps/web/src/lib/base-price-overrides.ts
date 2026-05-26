import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";
import {
  normalizeBusinessLine,
  toNumber,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
} from "@/lib/pricing-normalize";
import { normalizeKey as normalizeTextKey } from "@/lib/text-normalize";

export const BASE_PRICE_OVERRIDE_SCOPE = "base_price";

const BUSINESS_LINE_TARGET_ALIASES: Record<CanonicalBusinessLine, string[]> = {
  salud: ["salud"],
  licenciatura: ["licenciatura", "lic"],
  prepa: ["prepa", "preparatoria", "bachillerato", "bachiller"],
  posgrado: [
    "posgrado",
    "maestria",
    "maestría",
    "maestrias",
    "maestrías",
    "master",
    "doctorado",
  ],
};

function businessLineTargetKeys(businessLine: CanonicalBusinessLine | string) {
  const canonical = normalizeBusinessLine(String(businessLine));
  const aliases = canonical
    ? BUSINESS_LINE_TARGET_ALIASES[canonical]
    : [String(businessLine)];

  return new Set(
    [...aliases, String(businessLine)]
      .map((value) => normalizeKey(value))
      .filter(Boolean),
  );
}

function normalizeKey(value: unknown) {
  return normalizeTextKey(String(value ?? ""));
}

function normalizeCampusKey(value: unknown) {
  const normalized = normalizeKey(value);
  return normalized.replace(/^campus[\s_-]*/i, "").replace(/[^a-z0-9]/g, "");
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

function matchesBasePriceCoreTarget(
  keys: Record<string, unknown>,
  params: {
    businessLine: CanonicalBusinessLine | string;
    modality: CanonicalModalityValue | string;
    plan: number | string;
  },
) {
  const expectedBusinessLineKeys = businessLineTargetKeys(params.businessLine);
  const targetNivel = normalizeKey(keys.nivel_key ?? keys.businessLine ?? keys.nivel);
  const targetModality = normalizeKey(
    keys.modalidad_key ?? keys.modality ?? keys.modalidad,
  );
  const targetPlan = normalizeKey(keys.plan);

  return (
    expectedBusinessLineKeys.has(targetNivel) &&
    targetModality === normalizeKey(params.modality) &&
    targetPlan === normalizeKey(params.plan)
  );
}

function matchesBasePriceTierTarget(
  keys: Record<string, unknown>,
  params: {
    tier?: string | null;
  },
) {
  return normalizeTierKey(keys.tier) === normalizeTierKey(params.tier);
}

function normalizeCampusTargets(params: {
  campus?: string | null;
  campusAliases?: string[];
}) {
  return new Set(
    [params.campus, ...(params.campusAliases ?? [])]
      .flatMap((value) => [normalizeKey(value), normalizeCampusKey(value)])
      .filter(Boolean),
  );
}

function targetCampusKey(keys: Record<string, unknown>) {
  return normalizeCampusKey(keys.plantel ?? keys.campus ?? keys.sede ?? keys.metaKey);
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
  let campusPriceIgnoringTier: number | null = null;

  for (const override of overrides) {
    if (!override.isActive || override.scope !== BASE_PRICE_OVERRIDE_SCOPE) continue;
    const keys = targetRecord(override.targetKeys);
    if (!matchesBasePriceCoreTarget(keys, params)) continue;

    const price = toNumber(override.newPrice);
    if (price === null) continue;

    const campusKey = targetCampusKey(keys);
    const matchesTier = matchesBasePriceTierTarget(keys, params);

    if (campusKey) {
      if (!campusTargets.has(campusKey)) continue;

      if (matchesTier) return price;

      // Si el override ya está acotado por plantel, el plantel es más específico
      // que el tier. Esto evita caer al precio estático cuando el catálogo del
      // campus todavía no tiene tier, pero el precio canónico sí incluye plantel.
      if (campusPriceIgnoringTier === null) campusPriceIgnoringTier = price;
      continue;
    }

    if (!matchesTier) continue;
    if (genericPrice === null) genericPrice = price;
  }

  return campusPriceIgnoringTier ?? genericPrice;
}
