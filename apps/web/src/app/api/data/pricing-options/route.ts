import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  BASE_PRICE_OVERRIDE_SCOPE,
  findPublishedBasePriceOverride,
} from "@/lib/base-price-overrides";
import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";
import { buildQuotePricingOptions, type QuotePricingOption } from "@/lib/pricing-options";
import { normalizeAcademicPricingPlans } from "@/lib/academic-offer-plans";
import { academicModuleOrDefault, type AcademicModule } from "@/lib/academic-modules";
import { normalizeKey } from "@/lib/text-normalize";
import {
  ENROLLMENT_TYPES,
  basePriceFromRules,
  normalizeBusinessLine,
  normalizeCanonicalModality,
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
import {
  fileAssetToContentBucketObject,
  listFileAssetAssignmentsForTargets,
  listFileAssets,
  resolveProgramR2AssetPayload,
  type PublicFileAssetPayload,
} from "@/lib/file-assets";
import {
  findContentBucketPlanForProgram,
  listContentBucketObjects,
  type ContentBucketObject,
} from "@/lib/r2-content-bucket";

export const dynamic = "force-dynamic";

function buildPricingKey(option: {
  businessLine: string;
  modality: string;
  plan: number;
  module?: string | null;
  programId?: string | null;
  programKey?: string | null;
}) {
  return [
    option.businessLine,
    option.modality,
    option.plan,
    option.module ?? "Longitudinal",
    option.programId ?? "",
    option.programKey ?? "",
  ].join("|");
}

function buildPriceOnlyKey(option: {
  businessLine: string;
  modality: string;
  plan: number;
  module?: string | null;
  programKey?: string | null;
}) {
  return `${option.businessLine}|${option.modality}|${option.plan}|${option.module ?? "Longitudinal"}|${option.programKey ?? ""}`;
}

function targetRecord(targetKeys: unknown) {
  return targetKeys && typeof targetKeys === "object"
    ? (targetKeys as Record<string, unknown>)
    : {};
}

function hasSubjectPriceTarget(targetKeys: unknown) {
  const keys = targetRecord(targetKeys);
  const value =
    keys.subject_price_mxn ??
    keys.precio_por_materia ??
    keys.precioPorMateria ??
    keys.price_per_subject ??
    keys.subjectPriceMxn;
  if (value === null || value === undefined || value === "") return false;
  const numeric = Number(String(value).replace(/[$\s,]/g, ""));
  return Number.isFinite(numeric) && numeric >= 0;
}

function buildSubjectCountOptions(priceOverrides: Array<{ targetKeys: unknown }>) {
  return priceOverrides.some((override) => hasSubjectPriceTarget(override.targetKeys))
    ? [1, 2, 3, 4, 5, 6, 7]
    : [];
}

function normalizeProgramMatchKey(value: unknown) {
  return normalizeKey(String(value ?? "")).replace(/[^a-z0-9]/g, "");
}

function programMatchesPricingOption(
  program: { id: string; name: string },
  option: { programKey?: string | null },
) {
  const target = normalizeProgramMatchKey(option.programKey);
  if (!target) return true;

  const candidates = [
    normalizeProgramMatchKey(program.id),
    normalizeProgramMatchKey(program.name),
  ].filter(Boolean);

  return candidates.some(
    (candidate) =>
      candidate === target ||
      (target.length >= 5 && candidate.includes(target)) ||
      (candidate.length >= 5 && target.includes(candidate)),
  );
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

function buildStudyProgram(
  program: {
    id: string;
    name: string;
    businessLine: string | null;
    level: string | null;
    category: string | null;
    planPdfUrl: string | null;
    brochurePdfUrl?: string | null;
    planDriveLink: string | null;
    planUrl: string | null;
  },
  assets?: Record<string, PublicFileAssetPayload | null>,
  bucketPlan?: ContentBucketObject | null,
) {
  const businessLine =
    normalizeBusinessLine(program.businessLine) ??
    normalizeBusinessLine(program.level) ??
    normalizeBusinessLine(program.category);
  const legacyPlanUrl = getUnidepProgramPlanUrl(program);
  const r2Payload = resolveProgramR2AssetPayload({
    programId: program.id,
    planPdfUrl: bucketPlan?.previewUrl ?? legacyPlanUrl,
    brochurePdfUrl: program.brochurePdfUrl ?? null,
    assets: assets ?? {},
  });
  const planPdfUrl = r2Payload.planPdfUrl;
  const planDownloadUrl =
    r2Payload.r2Assets.studyPlan?.downloadUrl ??
    bucketPlan?.downloadUrl ??
    r2Payload.planDownloadUrl;

  if (!businessLine || !planPdfUrl) return null;

  return {
    id: program.id,
    name: program.name,
    businessLine,
    planPdfUrl,
    planDownloadUrl,
  };
}

function buildConfiguredOfferingPricingOptions(
  offerings: Array<{
    pricingPlans: number[];
    track: string | null;
    delivery: string;
    escolarizado: boolean;
    ejecutivo: boolean;
    lineOfBusiness: string | null;
    program: {
      id: string;
      name: string;
      businessLine: string | null;
      level: string | null;
      category: string | null;
      planPdfUrl: string | null;
      brochurePdfUrl: string | null;
      planDriveLink: string | null;
      planUrl: string | null;
    };
  }>,
  r2Assignments: Map<string, Record<string, PublicFileAssetPayload>>,
  bucketPlansByProgramId: Map<string, ContentBucketObject | null>,
): QuotePricingOption[] {
  const options = new Map<string, QuotePricingOption>();

  for (const offering of offerings) {
    const plans = normalizeAcademicPricingPlans(offering.pricingPlans);
    if (!plans.length) continue;

    const studyProgram = buildStudyProgram(
      {
        ...offering.program,
        businessLine:
          normalizeBusinessLine(offering.lineOfBusiness) ?? offering.program.businessLine,
      },
      r2Assignments.get(offering.program.id),
      bucketPlansByProgramId.get(offering.program.id),
    );
    if (!studyProgram) continue;

    for (const modality of getOfferingModalities(offering)) {
      for (const plan of plans) {
        for (const enrollmentType of ENROLLMENT_TYPES) {
          const option: QuotePricingOption = {
            enrollmentType,
            businessLine: studyProgram.businessLine,
            modality,
            plan,
            module: academicModuleOrDefault(offering.track),
            programKey: studyProgram.id,
            source: "offering",
          };
          options.set(
            [
              option.enrollmentType,
              option.businessLine,
              option.modality,
              option.plan,
              option.module,
              option.programKey ?? "",
            ].join("|"),
            option,
          );
        }
      }
    }
  }

  return Array.from(options.values());
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
    activeOfferings,
    catalogPrograms,
    bucketFiles,
    syncedPdfAssets,
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
        programaKey: true,
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
    prisma.programOffering.findMany({
      where: {
        isActive: true,
        campus: { isActive: true },
      },
      select: {
        id: true,
        campusId: true,
        pricingPlans: true,
        track: true,
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
            brochurePdfUrl: true,
            planDriveLink: true,
            planUrl: true,
          },
        },
      },
    }),
    getUnidepProgramCatalog(),
    listContentBucketObjects(),
    listFileAssets({ mimeType: "application/pdf", limit: 1000 }),
  ]);

  const academicOfferByCampus = new Map<string, typeof activeOfferings>();
  const fallbackPlanFiles = [
    ...syncedPdfAssets.map(fileAssetToContentBucketObject),
    ...bucketFiles,
  ];
  const bucketPlansByProgramId = new Map(
    Array.from(
      new Map(
        [
          ...activeOfferings.map((offering) => offering.program),
          ...catalogPrograms,
        ].map((program) => [program.id, program] as const),
      ).values(),
    ).map((program) => [
      program.id,
      findContentBucketPlanForProgram(program.name, fallbackPlanFiles),
    ] as const),
  );
  const r2Assignments = await listFileAssetAssignmentsForTargets(
    "program",
    Array.from(
      new Set([
        ...activeOfferings.map((offering) => offering.program.id),
        ...catalogPrograms.map((program) => program.id),
      ]),
    ),
  );
  const pricingOptions = [
    ...buildQuotePricingOptions(rules, priceOverrides),
    ...buildConfiguredOfferingPricingOptions(
      activeOfferings,
      r2Assignments,
      bucketPlansByProgramId,
    ),
  ];
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
              const candidateRules = rules.filter((rule) => {
                const ruleBusinessLine = normalizeBusinessLine(rule.businessLine);
                const ruleModality = normalizeCanonicalModality(rule.modality);
                return (
                  ruleBusinessLine === option.businessLine &&
                  ruleModality === option.modality &&
                  Number(rule.plan) === option.plan &&
                  tierCandidates.has(normalizeTier(rule.campusTier))
                );
              });
              const fallbackRules = rules.filter((rule) => {
                const ruleBusinessLine = normalizeBusinessLine(rule.businessLine);
                const ruleModality = normalizeCanonicalModality(rule.modality);
                return (
                  ruleBusinessLine === option.businessLine &&
                  ruleModality === option.modality &&
                  Number(rule.plan) === option.plan
                );
              });
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
                  module: option.module,
                  tier: runtimeTier,
                  campus: campus.name,
                  campusAliases: [
                    campus.id,
                    campus.name,
                    campus.metaKey,
                    campus.code,
                    campus.slug,
                  ].filter(Boolean),
                  programAliases: option.programKey ? [option.programKey] : [],
                },
              );
              const staticBasePrice = findStaticBasePrice({
                businessLine: option.businessLine,
                modality: option.modality,
                plan: option.plan,
              });

              if (option.source === "offering") {
                return true;
              }

              if (option.programKey) {
                return overrideBasePrice !== null;
              }

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
        {
          id: string;
          name: string;
          businessLine: string;
          planPdfUrl: string;
          planDownloadUrl: string | null;
        }
      >();
      const pricingWithPrograms = new Map<
        string,
        {
          businessLine: string;
          modality: string;
          plan: number;
          module: AcademicModule;
          programId: string;
          programKey?: string | null;
        }
      >();
      const offeredOptions = new Map<string, { businessLine: string; modality: string }>();

      for (const offering of academicOffer) {
        const studyProgram = buildStudyProgram(
          {
            ...offering.program,
            businessLine:
              normalizeBusinessLine(offering.lineOfBusiness) ?? offering.program.businessLine,
          },
          r2Assignments.get(offering.program.id),
          bucketPlansByProgramId.get(offering.program.id),
        );
        if (!studyProgram) continue;
        studyPrograms.set(studyProgram.id, studyProgram);

        const configuredPlans = normalizeAcademicPricingPlans(offering.pricingPlans);

        for (const modality of getOfferingModalities(offering)) {
          offeredOptions.set(`${studyProgram.businessLine}|${modality}`, {
            businessLine: studyProgram.businessLine,
            modality,
          });
          for (const option of campusPricingByKey.values()) {
            if (
              option.businessLine !== studyProgram.businessLine ||
              option.modality !== modality ||
              (configuredPlans.length > 0 && !configuredPlans.includes(option.plan)) ||
              option.module !== academicModuleOrDefault(offering.track) ||
              !programMatchesPricingOption(studyProgram, option)
            ) {
              continue;
            }
            pricingWithPrograms.set(
              buildPricingKey({ ...option, programId: studyProgram.id }),
              {
                businessLine: option.businessLine,
                modality: option.modality,
                plan: option.plan,
                module: option.module,
                programId: studyProgram.id,
                ...(option.programKey ? { programKey: option.programKey } : {}),
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
            left.module.localeCompare(right.module, "es") ||
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
          .map((program) =>
            buildStudyProgram(
              program,
              r2Assignments.get(program.id),
              bucketPlansByProgramId.get(program.id),
            ),
          )
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
    subjectCounts: buildSubjectCountOptions(priceOverrides),
  });
}
