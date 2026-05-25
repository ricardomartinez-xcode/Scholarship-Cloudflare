import { NextResponse } from "next/server";

import { getAcademicOfferVisibleCycles } from "@/lib/academic-offer-config";
import { getSessionUser } from "@/lib/authz";
import {
  BASE_PRICE_OVERRIDE_SCOPE,
  findPublishedBasePriceOverride,
} from "@/lib/base-price-overrides";
import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";
import { buildQuotePricingOptions } from "@/lib/pricing-options";
import {
  basePriceFromRules,
  normalizeBusinessLine,
  normalizeTier,
  toNumber,
  type CanonicalModalityValue,
} from "@/lib/pricing-normalize";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function buildPricingKey(option: {
  businessLine: string;
  modality: string;
  plan: number;
}) {
  return `${option.businessLine}|${option.modality}|${option.plan}`;
}

function normalizeRulesForBasePrice(
  rules: Array<{
    enrollmentType: string;
    businessLine: string;
    modality: string;
    plan: number;
    campusTier: string | null;
    minAverage: unknown;
    maxAverage: unknown;
    scholarshipPercent: unknown;
    discountedPriceMxn: unknown;
  }>,
) {
  return rules.map((rule) => ({
    enrollmentType: rule.enrollmentType,
    businessLine: rule.businessLine,
    modality: rule.modality,
    plan: rule.plan,
    campusTier: rule.campusTier,
    minAverage: toNumber(rule.minAverage),
    maxAverage: toNumber(rule.maxAverage),
    scholarshipPercent: toNumber(rule.scholarshipPercent),
    discountedPriceMxn: toNumber(rule.discountedPriceMxn),
  }));
}

export async function GET() {
  const auth = await getSessionUser();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (auth.status === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (auth.status === "inactive") {
    return NextResponse.json({ error: "inactive" }, { status: 403 });
  }

  const visibleCycles = await getAcademicOfferVisibleCycles();
  const [rules, priceOverrides, campuses, subjectPrices, activeOfferings] = await Promise.all([
    prisma.scholarshipRule.findMany({
      where: { sourceVersion: "canonical" },
      orderBy: [
        { businessLine: "asc" },
        { modality: "asc" },
        { plan: "asc" },
      ],
      select: {
        enrollmentType: true,
        businessLine: true,
        modality: true,
        plan: true,
        campusTier: true,
        minAverage: true,
        maxAverage: true,
        scholarshipPercent: true,
        discountedPriceMxn: true,
      },
    }),
    prisma.adminPriceOverride.findMany({
      where: {
        scope: BASE_PRICE_OVERRIDE_SCOPE,
        isActive: true,
      },
      select: {
        id: true,
        scope: true,
        targetKeys: true,
        newPrice: true,
        isActive: true,
        notes: true,
        updatedBy: true,
      },
    }),
    prisma.campus.findMany({
      where: { isActive: true, code: { not: "ONLINE" } },
      orderBy: [{ name: "asc" }],
      select: { id: true, code: true, metaKey: true, name: true, tier: true },
    }),
    prisma.returnSubjectPrice.findMany({
      where: { sourceVersion: "canonical" },
      distinct: ["subjectCount"],
      orderBy: [{ subjectCount: "asc" }],
      select: { subjectCount: true },
    }),
    prisma.programOffering.findMany({
      where: {
        isActive: true,
        cycle: { in: visibleCycles },
        campus: { isActive: true, code: { not: "ONLINE" } },
      },
      select: {
        campusId: true,
        delivery: true,
        escolarizado: true,
        ejecutivo: true,
        lineOfBusiness: true,
        program: {
          select: {
            businessLine: true,
          },
        },
      },
    }),
  ]);

  const academicOfferByCampus = new Map<
    string,
    { businessLines: Set<string>; modalities: Set<CanonicalModalityValue> }
  >();
  const pricingOptions = buildQuotePricingOptions(rules, priceOverrides);
  const priceOverrideSnapshots = priceOverrides.map(
    (override): PriceOverrideSnapshot => ({
      id: override.id,
      scope: override.scope,
      targetKeys: override.targetKeys,
      newPrice: Number(override.newPrice),
      isActive: override.isActive,
      notes: override.notes,
      updatedBy: override.updatedBy,
    }),
  );

  for (const offering of activeOfferings) {
    const businessLine =
      offering.program.businessLine ?? normalizeBusinessLine(offering.lineOfBusiness);
    if (!businessLine) continue;

    const entry =
      academicOfferByCampus.get(offering.campusId) ??
      { businessLines: new Set<string>(), modalities: new Set<CanonicalModalityValue>() };
    entry.businessLines.add(businessLine);
    if (offering.delivery === "ONLINE") {
      entry.modalities.add("online");
    } else {
      if (offering.escolarizado || !offering.ejecutivo) entry.modalities.add("presencial");
      if (offering.ejecutivo) entry.modalities.add("mixta");
    }
    academicOfferByCampus.set(offering.campusId, entry);
  }

  return NextResponse.json({
    ok: true,
    combinations: pricingOptions,
    campuses: campuses
      .map((campus) => {
        const academicOffer = academicOfferByCampus.get(campus.id);
        const campusPricingOptions = Array.from(
          new Map(
            pricingOptions
              .filter((option) => {
                const runtimeTier = normalizeTier(campus.tier ?? null);
                const tierCandidates = new Set([runtimeTier, "ANY"]);
                const candidateRules = rules.filter(
                  (rule) =>
                    rule.businessLine === option.businessLine &&
                    rule.modality === option.modality &&
                    Number(rule.plan) === option.plan &&
                    tierCandidates.has(normalizeTier(rule.campusTier)),
                );
                const fallbackRules = rules.filter(
                  (rule) =>
                    rule.businessLine === option.businessLine &&
                    rule.modality === option.modality &&
                    Number(rule.plan) === option.plan,
                );
                const ruleBasePrice = basePriceFromRules(
                  normalizeRulesForBasePrice(
                    candidateRules.length ? candidateRules : fallbackRules,
                  ),
                );
                const overrideBasePrice = findPublishedBasePriceOverride(
                  priceOverrideSnapshots,
                  {
                    businessLine: option.businessLine,
                    modality: option.modality,
                    plan: option.plan,
                    tier: runtimeTier,
                    campus: campus.name,
                    campusAliases: [campus.name, campus.metaKey, campus.code].filter(Boolean),
                  },
                );

                return ruleBasePrice !== null || overrideBasePrice !== null;
              })
              .map((option) => [buildPricingKey(option), option]),
          ).values(),
        );
        const academicOfferKeys = new Set<string>();
        for (const businessLine of academicOffer?.businessLines ?? []) {
          for (const modality of academicOffer?.modalities ?? []) {
            for (const option of campusPricingOptions) {
              if (option.businessLine === businessLine && option.modality === modality) {
                academicOfferKeys.add(buildPricingKey(option));
              }
            }
          }
        }
        return {
          value: campus.metaKey || campus.code || campus.name,
          label: campus.name,
          businessLines: Array.from(academicOffer?.businessLines ?? []).sort(),
          modalities: Array.from(academicOffer?.modalities ?? []).sort(),
          pricingOptions: campusPricingOptions
            .filter((option) => academicOfferKeys.has(buildPricingKey(option)))
            .map((option) => ({
              businessLine: option.businessLine,
              modality: option.modality,
              plan: option.plan,
            })),
        };
      })
      .filter((campus) => campus.businessLines.length > 0 && campus.pricingOptions.length > 0),
    subjectCounts: subjectPrices.map((row) => row.subjectCount),
  });
}
