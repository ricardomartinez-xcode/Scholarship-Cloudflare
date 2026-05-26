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
import { listActivePublishedPriceOverrides } from "@/lib/published-price-overrides";
import { resolveAdditionalBenefits } from "@/lib/additional-benefits";
import { buildCampusAliases, resolveCampus } from "@/lib/campus-resolver";
import {
  BASE_PRICE_OVERRIDE_SCOPE,
  findPublishedBasePriceOverride,
} from "@/lib/base-price-overrides";
import {
  basePriceFromRules,
  findNearestRule,
  findRuleForAverage,
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

export type ScholarshipQuoteInput = {
  enrollmentType: EnrollmentTypeValue;
  businessLine: CanonicalBusinessLine;
  modality: CanonicalModalityValue;
  plan: number;
  campus?: string | null;
  average: number;
  subjectCount?: number | null;
  extraChargeAmount?: number;
  selectedProgramId?: string | null;
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

  if (
    input.enrollmentType === "regreso" &&
    input.businessLine === "licenciatura" &&
    (!input.subjectCount || input.subjectCount <= 0)
  ) {
    return {
      ok: false,
      error: "Falta seleccionar materias.",
      hint: "Selecciona cuántas materias se van a inscribir.",
      missing: ["subjectCount"],
      source: "canonical",
    };
  }

  const campus = input.campus ? await resolveCampus(input.campus) : null;
  const runtimeTier =
    input.modality === "online"
      ? "ANY"
      : normalizeTier(campus?.tier ?? null);
  const tierCandidates = Array.from(new Set([runtimeTier, "ANY"]));

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

  let candidateRules = allRules.filter((rule) =>
    tierCandidates.includes(normalizeTier(rule.campusTier)),
  );
  if (!candidateRules.length) candidateRules = allRules;

  const normalizedCandidateRules = candidateRules.map((rule) => {
    return {
      enrollmentType: rule.enrollmentType,
      businessLine: rule.businessLine,
      modality: rule.modality,
      plan: rule.plan,
      campusTier: rule.campusTier,
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
    : findRuleForAverage(averageCandidateRules, average);

  if (!sinAccessToScholarship && averageCandidateRules.length && !matchedRule) {
    const nearest = findNearestRule(averageCandidateRules, average);
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

  const returnSubjectPrice =
    input.enrollmentType === "regreso" &&
    input.businessLine === "licenciatura" &&
    input.subjectCount &&
    campus
      ? await prisma.returnSubjectPrice.findFirst({
          where: {
            campusId: campus.id,
            modality: input.modality === "online" ? "online" : "presencial",
            subjectCount: input.subjectCount,
            sourceVersion,
          },
          orderBy: { updatedAt: "desc" },
        })
      : null;

  const basePriceOverride = findPublishedBasePriceOverride(overrides, {
    businessLine: input.businessLine,
    modality: input.modality,
    plan: input.plan,
    tier: runtimeTier,
    campus: input.campus ?? campus?.name ?? null,
    campusAliases: buildCampusAliases(campus, input.campus),
  });
  const ruleBasePrice = basePriceFromRules(normalizedCandidateRules);
  const staticBasePrice = findStaticBasePrice({
    businessLine: input.businessLine,
    modality: input.modality,
    plan: input.plan,
  });

  const returnSubjectPriceMxn = toNumber(returnSubjectPrice?.priceMxn);
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
        campus: input.campus ?? null,
        tier: runtimeTier,
        selectedProgramId: input.selectedProgramId ?? null,
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
