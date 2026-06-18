import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";
import { normalizeAcademicProgramKey } from "@relead/db/program-name-normalization";
import {
  normalizeBusinessLine,
  toNumber,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
} from "@/lib/pricing-normalize";
import { normalizeKey as normalizeTextKey } from "@/lib/text-normalize";

/**
 * Admin price imports and manual edits persist list prices with scope "base_price".
 * Quote resolution must use this source instead of derived rule/static prices.
 */
export const BASE_PRICE_OVERRIDE_SCOPE = "base_price";
const BASE_PRICE_OVERRIDE_SCOPES = new Set([BASE_PRICE_OVERRIDE_SCOPE]);

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

const LEGACY_PROGRAM_KEYS = new Set([
  "canonical",
  "canonico",
  "nuevo ingreso",
  "nuevo_ingreso",
  "regreso",
  "reingreso",
]);

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
  if (!raw || raw.toUpperCase() === "ANY" || raw.toUpperCase() === "ONLINE") return "";
  return raw.toUpperCase();
}

function targetRecord(targetKeys: unknown) {
  return targetKeys && typeof targetKeys === "object" && !Array.isArray(targetKeys)
    ? (targetKeys as Record<string, unknown>)
    : {};
}

function businessLineTargetKeys(businessLine: CanonicalBusinessLine | string) {
  const canonical = normalizeBusinessLine(String(businessLine));
  const aliases = canonical ? BUSINESS_LINE_TARGET_ALIASES[canonical] : [String(businessLine)];
  return new Set([...aliases, String(businessLine)].map(normalizeKey).filter(Boolean));
}

function targetBusinessLineKey(keys: Record<string, unknown>) {
  return normalizeKey(keys.nivel_key ?? keys.businessLine ?? keys.business_line ?? keys.nivel);
}

function targetModalityKey(keys: Record<string, unknown>) {
  return normalizeKey(keys.modalidad_key ?? keys.modality ?? keys.modalidad);
}

function targetPlanKey(keys: Record<string, unknown>) {
  return normalizeKey(keys.plan);
}

function matchesCoreTarget(
  keys: Record<string, unknown>,
  params: {
    businessLine: CanonicalBusinessLine | string;
    modality: CanonicalModalityValue | string;
    plan: number | string;
  },
) {
  const expectedBusinessLineKeys = businessLineTargetKeys(params.businessLine);
  const businessLineKey = targetBusinessLineKey(keys);
  const modalityKey = targetModalityKey(keys);
  const planKey = targetPlanKey(keys);

  return (
    expectedBusinessLineKeys.has(businessLineKey) &&
    modalityKey === normalizeKey(params.modality) &&
    planKey === normalizeKey(params.plan)
  );
}

function targetCampusKey(keys: Record<string, unknown>) {
  return normalizeCampusKey(
    keys.plantel ??
      keys.campus ??
      keys.sede ??
      keys.metaKey ??
      keys.campusName ??
      keys.campusCode,
  );
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

function campusTargetMatches(target: string, campusTargets: Set<string>) {
  if (!target) return true;
  return campusTargets.has(target);
}

function normalizeProgramTarget(value: unknown) {
  const normalized = normalizeKey(value);
  if (!normalized || LEGACY_PROGRAM_KEYS.has(normalized)) return "";
  return normalizeCompactKey(normalizeAcademicProgramKey(String(value ?? "")) || normalized);
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

function targetModuleKey(keys: Record<string, unknown>) {
  return normalizeKey(keys.modulo ?? keys.module);
}

function priceFromOverride(override: PriceOverrideSnapshot) {
  return toNumber(override.newPrice);
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

function isBasePriceScope(scope: string) {
  return BASE_PRICE_OVERRIDE_SCOPES.has(scope);
}

function getScopeScore(keys: Record<string, unknown>, params: {
  tier?: string | null;
  campus?: string | null;
  campusAliases?: string[];
  programId?: string | null;
  programName?: string | null;
  programAliases?: Array<string | null | undefined>;
  module?: string | null;
}) {
  const campusTargets = normalizeCampusTargets(params);
  const programTargets = normalizeProgramTargets(params);

  const campusKey = targetCampusKey(keys);
  if (!campusTargetMatches(campusKey, campusTargets)) return null;

  const programKey = targetProgramKey(keys);
  if (!programTargetMatches(programKey, programTargets)) return null;

  const moduleKey = targetModuleKey(keys);
  const expectedModule = normalizeKey(params.module);
  if (moduleKey && expectedModule && moduleKey !== expectedModule) return null;

  const targetTier = normalizeTierKey(keys.tier);
  const expectedTier = normalizeTierKey(params.tier);
  if (targetTier && targetTier !== expectedTier && (expectedTier || !campusKey)) {
    return null;
  }

  let score = 0;
  if (programKey) score += 1_000;
  if (campusKey) {
    score += targetTier ? (expectedTier ? 300 : 250) : 260;
  }
  if (!campusKey && targetTier) score += 150;
  if (moduleKey && expectedModule) score += 50;

  return score;
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
  let bestMatch: { price: number; score: number } | null = null;

  for (const override of overrides) {
    if (!override.isActive || !isBasePriceScope(override.scope)) continue;

    const keys = targetRecord(override.targetKeys);
    if (!matchesCoreTarget(keys, params)) continue;

    const price = priceFromOverride(override);
    if (price === null) continue;

    const score = getScopeScore(keys, params);
    if (score === null) continue;

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
  let bestMatch: { price: number; score: number } | null = null;

  for (const override of overrides) {
    if (!override.isActive || !isBasePriceScope(override.scope)) continue;

    const keys = targetRecord(override.targetKeys);
    if (!matchesCoreTarget(keys, params)) continue;

    const subjectPrice = subjectPriceFromTargetKeys(keys);
    if (subjectPrice === null) continue;

    const score = getScopeScore(keys, params);
    if (score === null) continue;

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { price: subjectPrice, score };
    }
  }

  return bestMatch?.price ?? null;
}
