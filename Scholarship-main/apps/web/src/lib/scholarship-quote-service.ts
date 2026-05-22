/**
 * scholarship-quote-service.ts — Canonical scholarship quote calculation engine (v2 system).
 *
 * This is the **official** quote resolution module. It reads rules from the
 * Prisma ORM layer (canonical `ScholarshipRule` table) and applies published
 * price overrides and additional benefits.
 *
 * Relationship with legacy-pricing.ts:
 *   Both engines are called by `GET /api/data/quote` for side-by-side comparison
 *   during the v1 → v2 migration. Once migration is complete and validated,
 *   `legacy-pricing.ts` will be retired and this module becomes the sole engine.
 *
 * See also: `runtime-modes.ts` for the feature flag that controls which engine
 * is primary vs comparison-only.
 */
import { prisma } from "@/lib/prisma";
import { listActivePublishedPriceOverrides } from "@/lib/published-price-overrides";
import { resolveAdditionalBenefits } from "@/lib/additional-benefits";
import {
  buildLegacyDiscountedOverrideMap,
  findPublishedBasePriceOverride,
  legacyDiscountedOverrideKey,
} from "@/lib/base-price-overrides";
import { resolveCampus } from "@/lib/campus-resolver";
import {
  basePriceFromRule,
  basePriceFromRules,
  findNearestRule,
  findRuleForAverage,
  getRuleEnrollmentType,
  listRuleRanges,
  normalizeTier,
  requiresCampusForQuote,
  toNumber,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
  type EnrollmentTypeValue,
} from "@/lib/pricing-normalize";

const MAX_REGRESO_SCHOLARSHIP = 25;

export type ScholarshipQuoteInput = {
  enrollmentType: EnrollmentTypeValue;
  businessLine: CanonicalBusinessLine;
  modality: CanonicalModalityValue;
  plan: number;
  campus?: string | null;
  average: number;
  subjectCount?: number | null;
  extraChargeAmount?: number;
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
      fixedScholarshipPercent: number;
      fixedScholarshipNotes: string | null;
      fixedScholarshipDuration: string | null;
      scholarshipSource: "average" | "fixed" | "none";
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
  const sourceVersion = input.sourceVersion ?? "legacy";
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
  const ruleEnrollmentType = getRuleEnrollmentType(input.enrollmentType);
  const tierCandidates = Array.from(new Set([runtimeTier, "ANY"]));

  const [allRules, overrides] = await Promise.all([
    prisma.scholarshipRule.findMany({
      where: {
        enrollmentType: ruleEnrollmentType,
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
    listActivePublishedPriceOverrides(),
  ]);

  if (!allRules.length) {
    return {
      ok: false,
      error: "No hay reglas para esta combinación.",
      hint: "Intenta cambiar línea de negocio, modalidad o plan de estudios.",
      source: "canonical",
    };
  }

  let candidateRules = allRules.filter((rule) =>
    tierCandidates.includes(normalizeTier(rule.campusTier)),
  );
  if (!candidateRules.length) candidateRules = allRules;

  const legacyDiscountedOverrideMap = buildLegacyDiscountedOverrideMap(overrides);
  const normalizedCandidateRules = candidateRules.map((rule) => {
    const overrideKey = legacyDiscountedOverrideKey({
      enrollmentType: rule.enrollmentType,
      businessLine: rule.businessLine,
      modality: rule.modality,
      plan: rule.plan,
      tier: rule.campusTier === "ANY" ? null : rule.campusTier,
    });

    return {
      enrollmentType: rule.enrollmentType,
      businessLine: rule.businessLine,
      modality: rule.modality,
      plan: rule.plan,
      campusTier: rule.campusTier,
      minAverage: toNumber(rule.minAverage),
      maxAverage: toNumber(rule.maxAverage),
      scholarshipPercent: toNumber(rule.scholarshipPercent),
      discountedPriceMxn:
        legacyDiscountedOverrideMap.get(overrideKey) ?? toNumber(rule.discountedPriceMxn),
    };
  });

  const benefits = await resolveAdditionalBenefits({
    campus: input.campus ?? campus?.metaKey ?? campus?.name ?? null,
    businessLine: input.businessLine,
    modality: input.modality,
    enrollmentType: ruleEnrollmentType,
  });

  const fixedScholarshipBenefit = benefits.fixedScholarshipBenefit;
  const fixedScholarshipPercent = fixedScholarshipBenefit?.extraPercent ?? 0;
  const usesFixedScholarship = fixedScholarshipPercent > 0;

  const average = Math.round(Number(input.average) * 10) / 10;
  const sinAccessToScholarship = average < 7 && !usesFixedScholarship;
  let matchedRule = sinAccessToScholarship || usesFixedScholarship
    ? null
    : findRuleForAverage(normalizedCandidateRules, average);

  if (!sinAccessToScholarship && !usesFixedScholarship && !matchedRule) {
    const nearest = findNearestRule(normalizedCandidateRules, average);
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

  if (!sinAccessToScholarship && !usesFixedScholarship && !matchedRule) {
    return {
      ok: false,
      error: "No se encontró costo para ese promedio en esta combinación.",
      hint:
        "Revisa el promedio o elige otra combinación. Abajo se muestran rangos válidos.",
      ranges: listRuleRanges(normalizedCandidateRules),
      source: "canonical",
    };
  }

  let scholarshipPercent = usesFixedScholarship
    ? fixedScholarshipPercent
    : matchedRule && "scholarshipPercent" in matchedRule
      ? (toNumber(matchedRule.scholarshipPercent) ?? 0)
      : 0;

  if (!usesFixedScholarship && input.enrollmentType !== "nuevo_ingreso") {
    scholarshipPercent = Math.min(
      scholarshipPercent,
      MAX_REGRESO_SCHOLARSHIP,
    );
  }

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
    tier: runtimeTier === "ANY" ? null : runtimeTier,
  });

  const basePriceMxn =
    toNumber(returnSubjectPrice?.priceMxn) ??
    basePriceOverride ??
    basePriceFromRules(normalizedCandidateRules) ??
    basePriceFromRule(
      matchedRule && "discountedPriceMxn" in matchedRule
        ? matchedRule
        : null,
    );

  if (basePriceMxn === null) {
    return {
      ok: false,
      error: "No fue posible determinar el costo base de esta combinación.",
      source: "canonical",
    };
  }

  const percentageBenefit =
    input.enrollmentType === "regreso" ? null : benefits.percentageBenefit;
  const firstPaymentBenefit = benefits.firstPaymentBenefit;
  const additionalBenefitPercent = percentageBenefit?.extraPercent ?? 0;
  const effectiveScholarshipPercent = sinAccessToScholarship ? 0 : scholarshipPercent;
  const scholarshipAmountMxn =
    basePriceMxn * (effectiveScholarshipPercent / 100);
  const additionalBenefitAmountMxn =
    basePriceMxn * (additionalBenefitPercent / 100);
  const firstPaymentAmountMxn = firstPaymentBenefit?.firstPaymentAmount ?? 0;
  const subtotalMxn =
    basePriceMxn - scholarshipAmountMxn - additionalBenefitAmountMxn;
  const totalMxn = subtotalMxn + Number(input.extraChargeAmount ?? 0);

  return {
    ok: true,
    basePriceMxn,
    scholarshipPercent: effectiveScholarshipPercent,
    scholarshipAmountMxn,
    additionalBenefitPercent,
    additionalBenefitNotes: percentageBenefit?.notes ?? null,
    additionalBenefitDuration: percentageBenefit?.duration ?? null,
    additionalBenefitAmountMxn,
    fixedScholarshipPercent: usesFixedScholarship ? fixedScholarshipPercent : 0,
    fixedScholarshipNotes: fixedScholarshipBenefit?.notes ?? null,
    fixedScholarshipDuration: fixedScholarshipBenefit?.duration ?? null,
    scholarshipSource: sinAccessToScholarship
      ? "none"
      : usesFixedScholarship
        ? "fixed"
        : "average",
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
