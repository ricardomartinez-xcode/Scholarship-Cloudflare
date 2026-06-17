/**
 * scholarship-quote-service.ts — Canonical scholarship quote calculation engine (v2 system).
 *
 * This is the **official** quote resolution module. It reads rules from the
 * Prisma ORM layer (canonical `ScholarshipRule` table) and applies published
 * price overrides and additional benefits.
 *
 * This module is now the sole quote engine for web and extension quote APIs.
 */
import { prisma } from "@/lib/prisma";
import { normalizeAcademicProgramKey } from "@relead/db/program-name-normalization";
import { listActivePublishedPriceOverrides } from "@/lib/published-price-overrides";
import { resolveAdditionalBenefits } from "@/lib/additional-benefits";
import { buildCampusAliases, resolveCampus } from "@/lib/campus-resolver";
import {
  BASE_PRICE_OVERRIDE_SCOPE,
  findPublishedBasePriceOverride,
  findPublishedSubjectPriceOverride,
} from "@/lib/base-price-overrides";
import {
  basePriceFromRules,
  listRuleRanges,
  normalizeTier,
  requiresCampusForQuote,
  toNumber,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
  type EnrollmentTypeValue,
} from "@/lib/pricing-normalize";
import { logStructured } from "@/lib/observability";
import { findStaticBasePrice } from "@/lib/static-costs";
import { normalizeKey as normalizeTextKey } from "@/lib/text-normalize";

export type ScholarshipQuoteInput = {
  enrollmentType: EnrollmentTypeValue;
  businessLine: CanonicalBusinessLine;
  modality: CanonicalModalityValue;
  plan: number;
  campus?: string | null;
  average: number;
  subjectCount?: number | null;
  module?: string | null;
  extraChargeAmount?: number;
  selectedProgramId?: string | null;
  selectedProgramName?: string | null;
  offeringId?: string | null;
  offerCycle?: string | null;
  sourceVersion?: string;
};

export type ScholarshipQuoteResult =
  | {
      ok: true;
      basePriceMxn: number;
      scholarshipPercent: number;
      scholarshipAmountMxn: number;
      additionalBenefitPercent: number;
      additionalBenefitNotes: string | null;
      additionalBenefitDuration: string | null;
      additionalBenefitAmountMxn: number;
      firstPaymentAmountMxn: number;
      firstPaymentNotes: string | null;
      firstPaymentDuration: string | null;
      subtotalMxn: number;
      totalMxn: number;
      tier: string | null;
      source: "canonical";
      sinAccessToScholarship: boolean;
    }
  | {
      ok: false;
      error: string;
      hint?: string;
      missing?: string[];
      ranges?: string[];
      source: "canonical";
    };



function normalizeScopeKey(value: unknown) {
  return normalizeTextKey(String(value ?? ""));
}

function normalizeCompactScopeKey(value: unknown) {
  return normalizeScopeKey(value).replace(/[^a-z0-9]/g, "");
}

function normalizeCampusScopeKey(value: unknown) {
  const normalized = normalizeScopeKey(value);
  return normalized.replace(/^campus[\s_-]*/i, "").replace(/[^a-z0-9]/g, "");
}

const LEGACY_PROGRAM_KEYS = new Set([
  "",
  "canonical",
  "canonico",
  "nuevo ingreso",
  "nuevo_ingreso",
  "regreso",
  "reingreso",
  "todos",
  "todas",
  "general",
  "any",
]);

function normalizeRuleProgramKey(value: unknown) {
  const normalized = normalizeScopeKey(value);
  if (LEGACY_PROGRAM_KEYS.has(normalized)) return "";
  return normalizeCompactScopeKey(normalizeAcademicProgramKey(String(value ?? "")) || normalized);
}

function buildProgramTargets(input: {
  programId?: string | null;
  programName?: string | null;
  aliases?: Array<string | null | undefined>;
}) {
  const targets = new Set<string>();
  for (const value of [
    input.programId,
    input.programName,
    ...(input.aliases ?? []),
  ]) {
    const normalized = normalizeRuleProgramKey(value);
    if (normalized) targets.add(normalized);
  }
  return targets;
}

function programScopeMatches(target: string, programTargets: Set<string>) {
  if (!target) return true;
  if (!programTargets.size) return false;

  for (const candidate of programTargets) {
    if (candidate === target) return true;
    if (target.length >= 5 && candidate.includes(target)) return true;
    if (candidate.length >= 5 && target.includes(candidate)) return true;
  }
  return false;
}

function buildCampusTargets(campusValue: string | null | undefined, aliases: string[]) {
  return new Set(
    [campusValue, ...aliases]
      .flatMap((value) => [normalizeScopeKey(value), normalizeCampusScopeKey(value)])
      .filter(Boolean),
  );
}

function campusScopeMatches(target: string, campusTargets: Set<string>) {
  if (!target) return true;
  return campusTargets.has(target);
}

function scholarshipRuleScopeScore(rule: {
  programaKey?: string | null;
  plantel?: string | null;
  region?: string | null;
  campusTier?: string | null;
}) {
  const hasProgram = Boolean(normalizeRuleProgramKey(rule.programaKey));
  const hasPlantel = Boolean(normalizeCampusScopeKey(rule.plantel));
  const tier = normalizeTier(rule.campusTier);
  const hasTier = tier !== "ANY" && tier !== "GENERAL";

  return (hasProgram ? 8 : 0) + (hasPlantel ? 4 : 0) + (hasTier ? 2 : 0);
}

function pickBestScopedRule<T extends {
  programaKey?: string | null;
  plantel?: string | null;
  region?: string | null;
  campusTier?: string | null;
  scholarshipPercent?: number | null;
}>(rules: T[]) {
  if (!rules.length) return null;

  return rules.reduce<T | null>((best, rule) => {
    if (!best) return rule;
    const scoreDiff = scholarshipRuleScopeScore(rule) - scholarshipRuleScopeScore(best);
    if (scoreDiff !== 0) return scoreDiff > 0 ? rule : best;

    const percentDiff = Number(rule.scholarshipPercent ?? 0) - Number(best.scholarshipPercent ?? 0);
    if (percentDiff !== 0) return percentDiff > 0 ? rule : best;

    return best;
  }, null);
}

function findBestRuleForAverage<T extends {
  minAverage: number | null;
  maxAverage: number | null;
  programaKey?: string | null;
  plantel?: string | null;
  region?: string | null;
  campusTier?: string | null;
  scholarshipPercent?: number | null;
}>(rules: T[], average: number) {
  const matches = rules.filter((rule) => {
    if (rule.minAverage === null || rule.maxAverage === null) return false;
    const min = rule.minAverage - 1e-6;
    const max = rule.maxAverage + 1e-6;
    return average >= min && average <= max;
  });
  return pickBestScopedRule(matches);
}

function findNearestScopedRule<T extends {
  minAverage: number | null;
  maxAverage: number | null;
  programaKey?: string | null;
  plantel?: string | null;
  region?: string | null;
  campusTier?: string | null;
  scholarshipPercent?: number | null;
}>(rules: T[], average: number) {
  let best: { rule: T; distance: number; score: number } | null = null;

  for (const rule of rules) {
    if (rule.minAverage === null || rule.maxAverage === null) continue;
    const distance =
      average < rule.minAverage
        ? rule.minAverage - average
        : average > rule.maxAverage
          ? average - rule.maxAverage
          : 0;
    const score = scholarshipRuleScopeScore(rule);
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && score > best.score)
    ) {
      best = { rule, distance, score };
    }
  }

  return best?.rule ?? null;
}
export async function resolveScholarshipQuote(
  input: ScholarshipQuoteInput,
): Promise<ScholarshipQuoteResult> {
  const sourceVersion = input.sourceVersion ?? "canonical";
  const requiresCampus = requiresCampusForQuote(
    input.businessLine,
    input.modality,
  );

  if (requiresCampus && !String(input.campus ?? "").trim()) {
    return {
      ok: false,
      error: "Falta seleccionar un plantel.",
      hint: "Selecciona un plantel para continuar con el cálculo.",
      missing: ["campus"],
      source: "canonical",
    };
  }

  const campus = input.campus ? await resolveCampus(input.campus) : null;
  const runtimeTier =
    input.modality === "online"
      ? "ANY"
      : normalizeTier(campus?.tier ?? null);
  const tierCandidates = Array.from(new Set([runtimeTier, "ANY"]));
  const campusAliases = buildCampusAliases(campus, input.campus);
  const campusTargets = buildCampusTargets(input.campus ?? campus?.name ?? null, campusAliases);
  const programTargets = buildProgramTargets({
    programId: input.selectedProgramId ?? null,
    programName: input.selectedProgramName ?? null,
    aliases: [
      input.selectedProgramId ?? null,
      input.selectedProgramName ?? null,
    ],
  });

  const [allRules, overrides] = await Promise.all([
    prisma.scholarshipRule.findMany({
      where: {
        businessLine: input.businessLine,
        modality: input.modality,
        plan: Number(input.plan),
        sourceVersion,
      },
      orderBy: [
        { campusTier: "asc" },
        { minAverage: "asc" },
        { maxAverage: "asc" },
      ],
    }),
    listActivePublishedPriceOverrides([
      BASE_PRICE_OVERRIDE_SCOPE,
    ]),
  ]);

  let candidateRules = allRules.filter((rule) => {
    const ruleProgram = normalizeRuleProgramKey(rule.programaKey);
    const rulePlantel = normalizeCampusScopeKey(rule.plantel);
    return (
      tierCandidates.includes(normalizeTier(rule.campusTier)) &&
      programScopeMatches(ruleProgram, programTargets) &&
      campusScopeMatches(rulePlantel, campusTargets)
    );
  });

  if (!candidateRules.length) {
    candidateRules = allRules.filter((rule) => {
      const ruleProgram = normalizeRuleProgramKey(rule.programaKey);
      const rulePlantel = normalizeCampusScopeKey(rule.plantel);
      return (
        !ruleProgram &&
        !rulePlantel &&
        tierCandidates.includes(normalizeTier(rule.campusTier))
      );
    });
  }

  if (!candidateRules.length) candidateRules = allRules;

  const normalizedCandidateRules = candidateRules.map((rule) => {
    return {
      enrollmentType: rule.enrollmentType,
      businessLine: rule.businessLine,
      modality: rule.modality,
      plan: rule.plan,
      campusTier: rule.campusTier,
      region: rule.region,
      plantel: rule.plantel,
      programaKey: rule.programaKey,
      minAverage: toNumber(rule.minAverage),
      maxAverage: toNumber(rule.maxAverage),
      scholarshipPercent: toNumber(rule.scholarshipPercent),
      discountedPriceMxn: toNumber(rule.discountedPriceMxn),
    };
  });
  const averageCandidateRules = normalizedCandidateRules;

  const average = Math.round(Number(input.average) * 10) / 10;
  const sinAccessToScholarship = average < 7;
  let matchedRule = sinAccessToScholarship || !averageCandidateRules.length
    ? null
    : findBestRuleForAverage(averageCandidateRules, average);

  if (!sinAccessToScholarship && averageCandidateRules.length && !matchedRule) {
    const nearest = findNearestScopedRule(averageCandidateRules, average);
    if (nearest) {
      const min = toNumber(nearest.minAverage);
      const max = toNumber(nearest.maxAverage);
      if (
        min !== null &&
        max !== null &&
        average >= min - 0.05 &&
        average <= max + 0.05
      ) {
        matchedRule = nearest;
      }
    }
  }

  if (!sinAccessToScholarship && averageCandidateRules.length > 0 && !matchedRule) {
    return {
      ok: false,
      error: "No se encontró costo para ese promedio en esta combinación.",
      hint:
        "Revisa el promedio o elige otra combinación. Abajo se muestran rangos válidos.",
      ranges: listRuleRanges(averageCandidateRules),
      source: "canonical",
    };
  }

  const scholarshipPercent =
    matchedRule && "scholarshipPercent" in matchedRule
      ? (toNumber(matchedRule.scholarshipPercent) ?? 0)
      : 0;

  const basePriceOverride = findPublishedBasePriceOverride(overrides, {
    businessLine: input.businessLine,
    modality: input.modality,
    plan: input.plan,
    tier: runtimeTier,
    campus: input.campus ?? campus?.name ?? null,
    campusAliases,
    programId: input.selectedProgramId ?? null,
    programName: input.selectedProgramName ?? null,
    module: input.module ?? null,
    programAliases: [
      input.selectedProgramId ?? null,
      input.selectedProgramName ?? null,
    ],
  });
  const subjectPriceOverride = findPublishedSubjectPriceOverride(overrides, {
    businessLine: input.businessLine,
    modality: input.modality,
    plan: input.plan,
    tier: runtimeTier,
    campus: input.campus ?? campus?.name ?? null,
    campusAliases,
    programId: input.selectedProgramId ?? null,
    programName: input.selectedProgramName ?? null,
    module: input.module ?? null,
    programAliases: [
      input.selectedProgramId ?? null,
      input.selectedProgramName ?? null,
    ],
  });
  const ruleBasePrice = basePriceFromRules(normalizedCandidateRules);
  const staticBasePrice = findStaticBasePrice({
    businessLine: input.businessLine,
    modality: input.modality,
    plan: input.plan,
  });

  const returnSubjectPriceMxn =
    input.enrollmentType === "regreso" &&
    input.businessLine === "licenciatura" &&
    input.subjectCount &&
    subjectPriceOverride !== null
      ? subjectPriceOverride * input.subjectCount
      : null;
  const basePriceMxn =
    returnSubjectPriceMxn ??
    basePriceOverride ??
    ruleBasePrice ??
    staticBasePrice;

  if (
    staticBasePrice !== null &&
    basePriceMxn === staticBasePrice &&
    basePriceOverride === null &&
    ruleBasePrice === null
  ) {
    logStructured("warn", "Quote used static base price fallback", {
      module: "scholarship-quote",
      action: "resolve-base-price",
      result: "fallback",
      metadata: {
        businessLine: input.businessLine,
        modality: input.modality,
        plan: input.plan,
        module: input.module ?? null,
        campus: input.campus ?? null,
        tier: runtimeTier,
        selectedProgramId: input.selectedProgramId ?? null,
        selectedProgramName: input.selectedProgramName ?? null,
        offeringId: input.offeringId ?? null,
      },
    });
  }

  if (basePriceMxn === null) {
    return {
      ok: false,
      error: "No fue posible determinar el costo base de esta combinación.",
      source: "canonical",
    };
  }

  const benefits = await resolveAdditionalBenefits({
    campus:
      input.campus ??
      campus?.metaKey ??
      campus?.name ??
      (input.modality === "online" ? "ONLINE" : null),
    businessLine: input.businessLine,
    modality: input.modality,
    enrollmentType: input.enrollmentType,
  });

  const percentageBenefit = benefits.percentageBenefit;
  const firstPaymentBenefit = benefits.firstPaymentBenefit;
  const additionalBenefitPercent = percentageBenefit?.extraPercent ?? 0;
  const scholarshipAmountMxn =
    sinAccessToScholarship ? 0 : basePriceMxn * (scholarshipPercent / 100);
  const additionalBenefitAmountMxn =
    basePriceMxn * (additionalBenefitPercent / 100);
  const firstPaymentAmountMxn = firstPaymentBenefit?.firstPaymentAmount ?? 0;
  const subtotalMxn =
    basePriceMxn - scholarshipAmountMxn - additionalBenefitAmountMxn;
  const totalMxn = subtotalMxn + Number(input.extraChargeAmount ?? 0);

  return {
    ok: true,
    basePriceMxn,
    scholarshipPercent: sinAccessToScholarship ? 0 : scholarshipPercent,
    scholarshipAmountMxn,
    additionalBenefitPercent,
    additionalBenefitNotes: percentageBenefit?.notes ?? null,
    additionalBenefitDuration: percentageBenefit?.duration ?? null,
    additionalBenefitAmountMxn,
    firstPaymentAmountMxn,
    firstPaymentNotes: firstPaymentBenefit?.notes ?? null,
    firstPaymentDuration: firstPaymentBenefit?.duration ?? null,
    subtotalMxn,
    totalMxn,
    tier: runtimeTier === "ANY" ? null : runtimeTier,
    source: "canonical",
    sinAccessToScholarship,
  };
}
