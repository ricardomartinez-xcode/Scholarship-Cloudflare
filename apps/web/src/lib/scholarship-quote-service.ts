/**
 * scholarship-quote-service.ts — Canonical scholarship quote calculation engine (v2 system).
 *
 * This is the **official** quote resolution module. It reads rules from the
 * Prisma ORM layer (canonical `ScholarshipRule` table) and applies published
 * price overrides and additional benefits.
 *
 * This module is now the sole quote engine for web and extension quote APIs.
 */
import { d1All, d1First, d1Run } from "@/lib/cloudflare/d1";
import { listD1ActiveCampuses, listD1PriceOverrides } from "@/lib/cloudflare/public-data";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
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
  listRuleRanges,
  normalizeTier,
  requiresCampusForQuote,
  toNumber,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
  type EnrollmentTypeValue,
} from "@/lib/pricing-normalize";
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

type D1ScholarshipRule = {
  enrollmentType: EnrollmentTypeValue;
  businessLine: CanonicalBusinessLine;
  modality: CanonicalModalityValue;
  plan: number;
  campusTier: string | null;
  region: string | null;
  plantel: string | null;
  programaKey: string | null;
  minAverage: number | null;
  maxAverage: number | null;
  scholarshipPercent: number | null;
  discountedPriceMxn: number | null;
};

type D1AdditionalBenefitPayload = {
  benefitType: "percentage" | "first_payment";
  enrollmentType: EnrollmentTypeValue | null;
  extraPercent: number;
  firstPaymentAmount: number;
  notes: string | null;
  appliesToAll: boolean;
  businessLine: string | null;
  modality: string | null;
  duration: string | null;
  sortIndex?: number;
  campusIds?: string[];
  updatedAt?: Date;
  isActive?: boolean;
};

let d1QuoteSchemaPromise: Promise<void> | null = null;

function bool(value: unknown) {
  return value === true || value === 1 || value === "1";
}

async function ensureD1QuoteSchema() {
  d1QuoteSchemaPromise ??= (async () => {
    await d1Run(
      `CREATE TABLE IF NOT EXISTS scholarship_rule (
        id TEXT PRIMARY KEY,
        enrollment_type TEXT NOT NULL,
        business_line TEXT NOT NULL,
        modality TEXT NOT NULL,
        plan INTEGER NOT NULL,
        campus_tier TEXT NOT NULL DEFAULT 'ANY',
        region TEXT NOT NULL DEFAULT '',
        plantel TEXT NOT NULL DEFAULT '',
        programa_key TEXT NOT NULL DEFAULT '',
        min_average REAL,
        max_average REAL,
        scholarship_percent REAL,
        discounted_price_mxn REAL,
        origin TEXT,
        source_version TEXT NOT NULL DEFAULT 'canonical',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await d1Run(
      "CREATE INDEX IF NOT EXISTS scholarship_rule_lookup_idx ON scholarship_rule(business_line, modality, plan)",
    );
    await d1Run(
      "CREATE INDEX IF NOT EXISTS scholarship_rule_source_enrollment_idx ON scholarship_rule(source_version, enrollment_type)",
    );
    await d1Run(
      `CREATE TABLE IF NOT EXISTS admin_additional_benefit (
        id TEXT PRIMARY KEY,
        applies_to_all INTEGER NOT NULL DEFAULT 0,
        benefit_type TEXT NOT NULL DEFAULT 'percentage',
        enrollment_type TEXT,
        extra_percent INTEGER NOT NULL DEFAULT 0,
        first_payment_amount REAL NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        business_line TEXT,
        modality TEXT,
        duration TEXT,
        updated_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await d1Run(
      `CREATE TABLE IF NOT EXISTS admin_additional_benefit_campus (
        benefit_id TEXT NOT NULL,
        campus_id TEXT NOT NULL,
        PRIMARY KEY (benefit_id, campus_id)
      )`,
    );
  })();

  return d1QuoteSchemaPromise;
}



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

function buildD1CampusAliases(
  campus: Awaited<ReturnType<typeof listD1ActiveCampuses>>[number] | null,
  raw: string | null | undefined,
) {
  return [
    raw,
    campus?.id,
    campus?.code,
    campus?.metaKey,
    campus?.name,
    campus?.slug,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

async function resolveD1Campus(raw: string | null | undefined) {
  const normalizedRaw = String(raw ?? "").trim();
  if (!normalizedRaw) return null;
  const exact = await d1First<{
    id: string;
    code: string;
    meta_key: string;
    name: string;
    slug: string;
    tier: string | null;
    kind: "campus" | "online";
  }>(
    `SELECT id, code, meta_key, name, slug, tier, kind
     FROM campus
     WHERE is_active = 1
       AND (lower(id) = lower(?) OR lower(code) = lower(?) OR lower(meta_key) = lower(?) OR lower(name) = lower(?) OR lower(slug) = lower(?))
     LIMIT 1`,
    [normalizedRaw, normalizedRaw, normalizedRaw, normalizedRaw, normalizedRaw],
  );
  if (exact) {
    return {
      id: exact.id,
      code: exact.code,
      metaKey: exact.meta_key,
      name: exact.name,
      slug: exact.slug,
      tier: exact.tier,
      kind: exact.kind,
    };
  }

  const key = normalizeScopeKey(normalizedRaw);
  const campuses = await listD1ActiveCampuses();
  return (
    campuses.find((campus) =>
      [campus.id, campus.code, campus.metaKey, campus.name, campus.slug]
        .map(normalizeScopeKey)
        .includes(key),
    ) ?? null
  );
}

async function listD1ScholarshipRules(input: ScholarshipQuoteInput, sourceVersion: string) {
  await ensureD1QuoteSchema();
  const rows = await d1All<{
    enrollment_type: string;
    business_line: string;
    modality: string;
    plan: number;
    campus_tier: string | null;
    region: string | null;
    plantel: string | null;
    programa_key: string | null;
    min_average: number | null;
    max_average: number | null;
    scholarship_percent: number | null;
    discounted_price_mxn: number | null;
  }>(
    `SELECT enrollment_type, business_line, modality, plan, campus_tier, region, plantel,
            programa_key, min_average, max_average, scholarship_percent, discounted_price_mxn
     FROM scholarship_rule
     WHERE business_line = ?
       AND modality = ?
       AND plan = ?
       AND source_version = ?
     ORDER BY campus_tier ASC, min_average ASC, max_average ASC`,
    [input.businessLine, input.modality, Number(input.plan), sourceVersion],
  );

  return rows.map(
    (row): D1ScholarshipRule => ({
      enrollmentType: row.enrollment_type as EnrollmentTypeValue,
      businessLine: row.business_line as CanonicalBusinessLine,
      modality: row.modality as CanonicalModalityValue,
      plan: Number(row.plan),
      campusTier: row.campus_tier,
      region: row.region,
      plantel: row.plantel,
      programaKey: row.programa_key,
      minAverage: toNumber(row.min_average),
      maxAverage: toNumber(row.max_average),
      scholarshipPercent: toNumber(row.scholarship_percent),
      discountedPriceMxn: toNumber(row.discounted_price_mxn),
    }),
  );
}

function pickBestD1Benefit(rows: D1AdditionalBenefitPayload[]) {
  if (!rows.length) return null;
  const score = (row: D1AdditionalBenefitPayload) =>
    (row.businessLine ? 1 : 0) + (row.modality ? 1 : 0) + (row.enrollmentType ? 1 : 0);

  return rows.reduce<D1AdditionalBenefitPayload | null>((best, row) => {
    if (!best) return row;
    const diff = score(row) - score(best);
    if (diff !== 0) return diff > 0 ? row : best;
    const rowIndex = row.sortIndex ?? Number.POSITIVE_INFINITY;
    const bestIndex = best.sortIndex ?? Number.POSITIVE_INFINITY;
    if (rowIndex !== bestIndex) return rowIndex < bestIndex ? row : best;
    if (row.updatedAt && best.updatedAt && row.updatedAt.getTime() !== best.updatedAt.getTime()) {
      return row.updatedAt > best.updatedAt ? row : best;
    }
    return best;
  }, null);
}

function stripD1Benefit(row: D1AdditionalBenefitPayload | null) {
  if (!row) return null;
  const { sortIndex, campusIds, updatedAt, isActive, ...rest } = row;
  void sortIndex;
  void campusIds;
  void updatedAt;
  void isActive;
  return rest;
}

function recoverBasePriceFromDiscountedPrice(
  discountedPrice: unknown,
  scholarshipPercent: unknown,
) {
  const discounted = toNumber(discountedPrice);
  if (discounted === null || discounted <= 0) return null;

  const scholarship = toNumber(scholarshipPercent) ?? 0;
  if (scholarship <= 0) return discounted;
  if (scholarship >= 100) return null;

  return Math.round((discounted / (1 - scholarship / 100)) * 100) / 100;
}

function pickBestD1BenefitByType(params: {
  rows: D1AdditionalBenefitPayload[];
  benefitType: "percentage" | "first_payment";
  campusId?: string | null;
}) {
  const typed = params.rows.filter((row) => row.benefitType === params.benefitType);
  if (!typed.length) return null;

  if (params.campusId) {
    const scoped = pickBestD1Benefit(
      typed.filter(
        (row) => !row.appliesToAll && row.campusIds?.includes(params.campusId ?? ""),
      ),
    );
    if (scoped) return stripD1Benefit(scoped);
  }

  return stripD1Benefit(pickBestD1Benefit(typed.filter((row) => row.appliesToAll)));
}

async function resolveD1AdditionalBenefits(params: {
  campusId?: string | null;
  businessLine?: CanonicalBusinessLine | null;
  modality?: CanonicalModalityValue | null;
  enrollmentType?: EnrollmentTypeValue | null;
}) {
  await ensureD1QuoteSchema();
  const rows = await d1All<{
    id: string;
    applies_to_all: number;
    benefit_type: string;
    enrollment_type: string | null;
    extra_percent: number;
    first_payment_amount: number;
    is_active: number;
    notes: string | null;
    business_line: string | null;
    modality: string | null;
    duration: string | null;
    updated_at: string | null;
    campus_ids: string | null;
  }>(
    `SELECT b.id, b.applies_to_all, b.benefit_type, b.enrollment_type,
            b.extra_percent, b.first_payment_amount, b.is_active, b.notes,
            b.business_line, b.modality, b.duration, b.updated_at,
            GROUP_CONCAT(bc.campus_id) AS campus_ids
     FROM admin_additional_benefit b
     LEFT JOIN admin_additional_benefit_campus bc ON bc.benefit_id = b.id
     WHERE b.is_active = 1
     GROUP BY b.id
     ORDER BY b.updated_at DESC`,
  );

  const candidates = rows
    .map((row, index): D1AdditionalBenefitPayload => ({
      benefitType: row.benefit_type === "first_payment" ? "first_payment" : "percentage",
      enrollmentType: (row.enrollment_type as EnrollmentTypeValue | null) ?? null,
      extraPercent: Number(row.extra_percent ?? 0),
      firstPaymentAmount: Number(row.first_payment_amount ?? 0),
      notes: row.notes,
      appliesToAll: Boolean(row.applies_to_all),
      businessLine: row.business_line,
      modality: row.modality,
      duration: row.duration,
      sortIndex: index,
      campusIds: row.campus_ids ? row.campus_ids.split(",").filter(Boolean) : [],
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      isActive: bool(row.is_active),
    }))
    .filter((benefit) => {
      const businessLineMatches = params.businessLine
        ? benefit.businessLine === null || benefit.businessLine === params.businessLine
        : benefit.businessLine === null;
      const modalityMatches = params.modality
        ? benefit.modality === null || benefit.modality === params.modality
        : benefit.modality === null;
      const enrollmentMatches = params.enrollmentType
        ? benefit.enrollmentType === null || benefit.enrollmentType === params.enrollmentType
        : benefit.enrollmentType === null;
      const campusMatches = params.campusId
        ? benefit.appliesToAll || benefit.campusIds?.includes(params.campusId)
        : benefit.appliesToAll;

      return (
        Boolean(benefit.isActive ?? true) &&
        businessLineMatches &&
        modalityMatches &&
        enrollmentMatches &&
        campusMatches
      );
    });

  return {
    percentageBenefit: pickBestD1BenefitByType({
      rows: candidates,
      benefitType: "percentage",
      campusId: params.campusId ?? null,
    }),
    firstPaymentBenefit: pickBestD1BenefitByType({
      rows: candidates,
      benefitType: "first_payment",
      campusId: params.campusId ?? null,
    }),
  };
}

async function resolveD1ScholarshipQuote(
  input: ScholarshipQuoteInput,
): Promise<ScholarshipQuoteResult> {
  await ensureD1QuoteSchema();
  const sourceVersion = input.sourceVersion ?? "canonical";
  const requiresCampus = requiresCampusForQuote(input.businessLine, input.modality);

  if (requiresCampus && !String(input.campus ?? "").trim()) {
    return {
      ok: false,
      error: "Falta seleccionar un plantel.",
      hint: "Selecciona un plantel para continuar con el cálculo.",
      missing: ["campus"],
      source: "canonical",
    };
  }

  const campus = input.campus ? await resolveD1Campus(input.campus) : null;
  const runtimeTier = input.modality === "online" ? "ANY" : normalizeTier(campus?.tier ?? null);
  const tierCandidates = Array.from(new Set([runtimeTier, "ANY"]));
  const campusAliases = buildD1CampusAliases(campus, input.campus);
  const campusTargets = buildCampusTargets(input.campus ?? campus?.name ?? null, campusAliases);
  const programTargets = buildProgramTargets({
    programId: input.selectedProgramId ?? null,
    programName: input.selectedProgramName ?? null,
    aliases: [input.selectedProgramId ?? null, input.selectedProgramName ?? null],
  });

  const [allRules, overrides] = await Promise.all([
    listD1ScholarshipRules(input, sourceVersion),
    listD1PriceOverrides(BASE_PRICE_OVERRIDE_SCOPE),
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

  const average = Math.round(Number(input.average) * 10) / 10;
  const sinAccessToScholarship = average < 7;
  let matchedRule =
    sinAccessToScholarship || !candidateRules.length
      ? null
      : findBestRuleForAverage(candidateRules, average);

  if (!sinAccessToScholarship && candidateRules.length && !matchedRule) {
    const nearest = findNearestScopedRule(candidateRules, average);
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

  if (!sinAccessToScholarship && candidateRules.length > 0 && !matchedRule) {
    return {
      ok: false,
      error: "No se encontró costo para ese promedio en esta combinación.",
      hint: "Revisa el promedio o elige otra combinación. Abajo se muestran rangos válidos.",
      ranges: listRuleRanges(candidateRules),
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
    programAliases: [input.selectedProgramId ?? null, input.selectedProgramName ?? null],
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
    programAliases: [input.selectedProgramId ?? null, input.selectedProgramName ?? null],
  });
  const returnSubjectPriceMxn =
    input.enrollmentType === "regreso" &&
    input.businessLine === "licenciatura" &&
    input.subjectCount &&
    subjectPriceOverride !== null
      ? subjectPriceOverride * input.subjectCount
      : null;
  const d1RuleBasePriceFallback =
    overrides.length === 0 && matchedRule
      ? recoverBasePriceFromDiscountedPrice(
          matchedRule.discountedPriceMxn,
          scholarshipPercent,
        )
      : null;
  const basePriceMxn =
    returnSubjectPriceMxn ?? basePriceOverride ?? d1RuleBasePriceFallback;

  if (basePriceMxn === null) {
    return {
      ok: false,
      error: "No hay precio lista publicado para esta combinación.",
      hint: "Publica el precio correspondiente en Admin > Precios antes de generar la cotización.",
      missing: ["basePrice"],
      source: "canonical",
    };
  }

  const benefits = await resolveD1AdditionalBenefits({
    campusId: campus?.id ?? null,
    businessLine: input.businessLine,
    modality: input.modality,
    enrollmentType: input.enrollmentType,
  });

  const percentageBenefit = benefits.percentageBenefit;
  const firstPaymentBenefit = benefits.firstPaymentBenefit;
  const additionalBenefitPercent = percentageBenefit?.extraPercent ?? 0;
  const scholarshipAmountMxn =
    sinAccessToScholarship ? 0 : basePriceMxn * (scholarshipPercent / 100);
  const additionalBenefitAmountMxn = basePriceMxn * (additionalBenefitPercent / 100);
  const firstPaymentAmountMxn = firstPaymentBenefit?.firstPaymentAmount ?? 0;
  const subtotalMxn = basePriceMxn - scholarshipAmountMxn - additionalBenefitAmountMxn;
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

export async function resolveScholarshipQuote(
  input: ScholarshipQuoteInput,
): Promise<ScholarshipQuoteResult> {
  if (isCloudflareRuntime()) {
    return resolveD1ScholarshipQuote(input);
  }

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
  const returnSubjectPriceMxn =
    input.enrollmentType === "regreso" &&
    input.businessLine === "licenciatura" &&
    input.subjectCount &&
    subjectPriceOverride !== null
      ? subjectPriceOverride * input.subjectCount
      : null;
  const basePriceMxn =
    returnSubjectPriceMxn ??
    basePriceOverride;

  if (basePriceMxn === null) {
    return {
      ok: false,
      error: "No hay precio lista publicado para esta combinación.",
      hint:
        "Publica el precio correspondiente en Admin > Precios antes de generar la cotización.",
      missing: ["basePrice"],
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
