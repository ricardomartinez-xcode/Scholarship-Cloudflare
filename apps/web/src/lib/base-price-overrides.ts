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

const LEGACY_PROGRAMA_KEYS = new Set([
  "canonical",
  "canonico",
  "nuevo ingreso",
  "nuevo_ingreso",
  "regreso",
  "reingreso",
]);

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

function normalizeCompactKey(value: unknown) {
  return normalizeKey(value).replace(/[^a-z0-9]/g, "");
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

function getGenericTierMatchScore(
  keys: Record<string, unknown>,
  params: {
    tier?: string | null;
  },
) {
  const targetTier = normalizeTierKey(keys.tier);
  const expectedTier = normalizeTierKey(params.tier);

  if (!targetTier) return 1;
  return targetTier === expectedTier ? 2 : 0;
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

function normalizeProgramTarget(value: unknown) {
  const normalized = normalizeKey(value);
  if (!normalized || LEGACY_PROGRAMA_KEYS.has(normalized)) return "";
  return normalizeCompactKey(normalized);
}

function normalizeProgramTargets(params: {
  programId?: string | null;
  programName?: string | null;
  programAliases?: Array<string | null | undefined>;
}) {
  const values = [
    params.programId,
    params.programName,
    ...(params.programAliases ?? []),
  ].filter(Boolean);

  const targets = new Set<string>();
  for (const value of values) {
    const normalized = normalizeProgramTarget(value);
    if (normalized) targets.add(normalized);
  }
  return targets;
}

function programTargetMatches(target: string, programTargets: Set<string>) {
  if (!target) return true;
  if (!programTargets.size) return false;

  for (const candidate of programTargets) {
    if (candidate === target) return true;
    if (target.length >= 5 && candidate.includes(target)) return true;
    if (candidate.length >= 5 && target.includes(candidate)) return true;
  }
  return false;
}

function targetProgramKey(keys: Record<string, unknown>) {
  return normalizeProgramTarget(
    keys.programa_key ??
      keys.programaKey ??
      keys.program_key ??
      keys.programId ??
      keys.program_id ??
      keys.programa ??
      keys.program,
  );
}

function targetCampusKey(keys: Record<string, unknown>) {
  return normalizeCampusKey(keys.plantel ?? keys.campus ?? keys.sede ?? keys.metaKey);
}

function subjectPriceFromTargetKeys(keys: Record<string, unknown>) {
  return toNumber(
    keys.subject_price_mxn ??
      keys.precio_por_materia ??
      keys.precioPorMateria ??
      keys.price_per_subject ??
      keys.subjectPriceMxn,
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
    programId?: string | null;
    programName?: string | null;
    programAliases?: Array<string | null | undefined>;
    module?: string | null;
  },
) {
  const campusTargets = normalizeCampusTargets(params);
  const programTargets = normalizeProgramTargets(params);
  let bestMatch: { price: number; score: number } | null = null;

  for (const override of overrides) {
    if (!override.isActive || override.scope !== BASE_PRICE_OVERRIDE_SCOPE) continue;
    const keys = targetRecord(override.targetKeys);
    if (!matchesBasePriceCoreTarget(keys, params)) continue;

    const programKey = targetProgramKey(keys);
    if (!programTargetMatches(programKey, programTargets)) continue;

    const price = toNumber(override.newPrice);
    if (price === null) continue;

    const campusKey = targetCampusKey(keys);
    const targetTier = normalizeTierKey(keys.tier);
    const expectedTier = normalizeTierKey(params.tier);
    const programScore = programKey ? 1_000 : 0;
    let scopeScore = 0;

    if (campusKey) {
      if (!campusTargets.has(campusKey)) continue;

      // Plantel exacto es más específico que tier. Si el catálogo del campus
      // viene sin tier, no descartamos un precio canónico acotado por plantel.
      scopeScore = !targetTier
        ? 260
        : targetTier === expectedTier
          ? 300
          : 250;
    } else {
      const tierScore = getGenericTierMatchScore(keys, params);
      if (!tierScore) continue;
      // Sin plantel: precio por tier gana sobre precio general.
      scopeScore = tierScore === 2 ? 150 : 100;
    }

    const score = programScore + scopeScore;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { price, score };
    }
  }

  return bestMatch?.price ?? null;
}

export function findPublishedSubjectPriceOverride(
  overrides: PriceOverrideSnapshot[],
  params: Parameters<typeof findPublishedBasePriceOverride>[1],
) {
  const campusTargets = normalizeCampusTargets(params);
  const programTargets = normalizeProgramTargets(params);
  let bestMatch: { price: number; score: number } | null = null;

  for (const override of overrides) {
    if (!override.isActive || override.scope !== BASE_PRICE_OVERRIDE_SCOPE) continue;
    const keys = targetRecord(override.targetKeys);
    if (!matchesBasePriceCoreTarget(keys, params)) continue;

    const subjectPrice = subjectPriceFromTargetKeys(keys);
    if (subjectPrice === null) continue;

    const programKey = targetProgramKey(keys);
    if (!programTargetMatches(programKey, programTargets)) continue;

    const campusKey = targetCampusKey(keys);
    const targetTier = normalizeTierKey(keys.tier);
    const expectedTier = normalizeTierKey(params.tier);
    const programScore = programKey ? 1_000 : 0;
    let scopeScore = 0;

    if (campusKey) {
      if (!campusTargets.has(campusKey)) continue;
      scopeScore = !targetTier
        ? 260
        : targetTier === expectedTier
          ? 300
          : 250;
    } else {
      const tierScore = getGenericTierMatchScore(keys, params);
      if (!tierScore) continue;
      scopeScore = tierScore === 2 ? 150 : 100;
    }

    const score = programScore + scopeScore;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { price: subjectPrice, score };
    }
  }

  return bestMatch?.price ?? null;
}
