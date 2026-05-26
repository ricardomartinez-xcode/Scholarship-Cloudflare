import { NextResponse } from "next/server";

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
import { findStaticBasePrice } from "@/lib/static-costs";
import {
  getUnidepProgramCatalog,
  getUnidepProgramPlanUrl,
} from "@/lib/unidep-program-catalog";

export const dynamic = "force-dynamic";

function buildPricingKey(option: {
  businessLine: string;
  modality: string;
  plan: number;
  programId?: string | null;
}) {
  return `${option.businessLine}|${option.modality}|${option.plan}|${option.programId ?? ""}`;
}

function buildPriceOnlyKey(option: {
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

function getOfferingModalities(offering: {
  delivery: string;
  escolarizado: boolean;
  ejecutivo: boolean;
}): CanonicalModalityValue[] {
  if (offering.delivery === "ONLINE") return ["online"];
  const modalities = new Set<CanonicalModalityValue>();
  if (offering.escolarizado || !offering.ejecutivo) modalities.add("presencial");
  if (offering.ejecutivo) modalities.add("mixta");
  return Array.from(modalities);
}

function buildStudyProgram(program: {
  id: string;
  name: string;
  businessLine: string | null;
  level: string | null;
  category: string | null;
  planPdfUrl: string | null;
  planDriveLink: string | null;
  planUrl: string | null;
}) {
  const businessLine =
    normalizeBusinessLine(program.businessLine) ??
    normalizeBusinessLine(program.level) ??
    normalizeBusinessLine(program.category);
  const planPdfUrl = getUnidepProgramPlanUrl(program);

  if (!businessLine || !planPdfUrl) return null;

  return {
    id: program.id,
    name: program.name,
    businessLine,
    planPdfUrl,
  };
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

  const [
    rules,
    priceOverrides,
    campuses,
    subjectPrices,
    activeOfferings,
    catalogPrograms,
  ] = await Promise.all([
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
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, code: true, metaKey: true, name: true, slug: true, tier: true },
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
        campus: { isActive: true },
      },
      select: {
        campusId: true,
        delivery: true,
        escolarizado: true,
        ejecutivo: true,
        lineOfBusiness: true,
        program: {
          select: {
            id: true,
            name: true,
            businessLine: true,
            level: true,
            category: true,
            planPdfUrl: true,
            planDriveLink: true,
            planUrl: true,
          },
        },
      },
    }),
    getUnidepProgramCatalog({ onlyWithPlan: true }),
  ]);

  const academicOfferByCampus = new Map<string, typeof activeOfferings>();
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
    const entry = academicOfferByCampus.get(offering.campusId) ?? [];
    entry.push(offering);
    academicOfferByCampus.set(offering.campusId, entry);
  }

  const responseCampuses = campuses
    .map((campus) => {
      const academicOffer = academicOfferByCampus.get(campus.id) ?? [];
      const runtimeTier =
        campus.code === "ONLINE" ? "ANY" : normalizeTier(campus.tier ?? null);
      const campusPricingOptions = Array.from(
        new Map(
          pricingOptions
            .filter((option) => {
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
                  campusAliases: [
                    campus.id,
                    campus.name,
                    campus.metaKey,
                    campus.code,
                    campus.slug,
                  ].filter(Boolean),
                },
              );
              const staticBasePrice = findStaticBasePrice({
                businessLine: option.businessLine,
                modality: option.modality,
                plan: option.plan,
              });

              return (
                ruleBasePrice !== null ||
                overrideBasePrice !== null ||
                staticBasePrice !== null
              );
            })
            .map((option) => [buildPriceOnlyKey(option), option]),
        ).values(),
      );
      const campusPricingByKey = new Map(
        campusPricingOptions.map((option) => [buildPriceOnlyKey(option), option]),
      );
      const studyPrograms = new Map<
        string,
        { id: string; name: string; businessLine: string; planPdfUrl: string }
      >();
      const pricingWithPrograms = new Map<
        string,
        {
          businessLine: string;
          modality: string;
          plan: number;
          programId: string;
        }
      >();
      const offeredOptions = new Map<string, { businessLine: string; modality: string }>();

      for (const offering of academicOffer) {
        const studyProgram = buildStudyProgram({
          ...offering.program,
          businessLine:
            offering.program.businessLine ?? normalizeBusinessLine(offering.lineOfBusiness),
        });
        if (!studyProgram) continue;
        studyPrograms.set(studyProgram.id, studyProgram);

        for (const modality of getOfferingModalities(offering)) {
          offeredOptions.set(`${studyProgram.businessLine}|${modality}`, {
            businessLine: studyProgram.businessLine,
            modality,
          });
          for (const option of campusPricingByKey.values()) {
            if (
              option.businessLine !== studyProgram.businessLine ||
              option.modality !== modality
            ) {
              continue;
            }
            pricingWithPrograms.set(
              buildPricingKey({ ...option, programId: studyProgram.id }),
              {
                businessLine: option.businessLine,
                modality: option.modality,
                plan: option.plan,
                programId: studyProgram.id,
              },
            );
          }
        }
      }

      const pricedOptions = Array.from(pricingWithPrograms.values());
      return {
        value: campus.metaKey || campus.code || campus.name,
        label: campus.name,
        businessLines: Array.from(
          new Set(Array.from(offeredOptions.values()).map((option) => option.businessLine)),
        ).sort(),
        modalities: Array.from(
          new Set(Array.from(offeredOptions.values()).map((option) => option.modality)),
        ).sort(),
        studyPrograms: Array.from(studyPrograms.values()).sort((left, right) =>
          left.name.localeCompare(right.name, "es"),
        ),
        pricingOptions: pricedOptions.sort(
          (left, right) =>
            left.businessLine.localeCompare(right.businessLine, "es") ||
            left.modality.localeCompare(right.modality, "es") ||
            left.plan - right.plan ||
            left.programId.localeCompare(right.programId, "es"),
        ),
      };
    })
    .filter((campus) => campus.studyPrograms.length > 0);

  const pricedStudyPrograms = Array.from(
    new Map(
      responseCampuses.flatMap((campus) =>
        campus.studyPrograms.map((program) => [program.id, program] as const),
      ),
    ).values(),
  );
  const studyPrograms = Array.from(
    new Map(
      [
        ...catalogPrograms
          .map((program) => buildStudyProgram(program))
          .filter((program): program is NonNullable<ReturnType<typeof buildStudyProgram>> =>
            Boolean(program),
          ),
        ...pricedStudyPrograms,
      ].map((program) => [program.id, program] as const),
    ).values(),
  ).sort(
    (left, right) =>
      left.businessLine.localeCompare(right.businessLine, "es") ||
      left.name.localeCompare(right.name, "es"),
  );

  return NextResponse.json({
    ok: true,
    combinations: pricingOptions,
    studyPrograms,
    campuses: responseCampuses,
    subjectCounts: subjectPrices.map((row) => row.subjectCount),
  });
}
