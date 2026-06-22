import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";
import { academicModuleOrDefault } from "@/lib/academic-modules";
import { normalizeAcademicPricingPlans } from "@/lib/academic-offer-plans";
import {
  BASE_PRICE_OVERRIDE_SCOPE,
  findPublishedBasePriceOverride,
} from "@/lib/base-price-overrides";
import {
  normalizeBusinessLine,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
} from "@/lib/pricing-normalization";
import { prisma } from "@/lib/prisma";
import { listActivePublishedPriceOverrides } from "@/lib/published-price-overrides";

export type PriceCoverageContext = {
  offeringId: string;
  cycle: string;
  businessLine: CanonicalBusinessLine;
  modality: CanonicalModalityValue;
  programId: string;
  programName: string;
  campusId: string;
  campusKey: string;
  campusName: string;
  campusTier: string | null;
  pricingPlans: number[];
  module: string;
  campusAliases?: string[];
  programAliases?: Array<string | null | undefined>;
};

export type PriceCoverageIssue = {
  kind:
    | "missing_base_price"
    | "offering_without_pricing_plan"
    | "unresolvable_offering_context";
  offeringId: string;
  cycle: string;
  campus: string;
  program: string;
  businessLine: string | null;
  modality: string | null;
  plan: number | null;
  module: string | null;
  tier: string | null;
  message: string;
};

export type PriceCoverageReport = {
  generatedAt: string;
  cycle: string | null;
  offeringsChecked: number;
  combinationsChecked: number;
  coveredCombinations: number;
  issues: PriceCoverageIssue[];
};

export type ActivePriceCoverageInputs = {
  contexts: PriceCoverageContext[];
  unresolvedIssues: PriceCoverageIssue[];
};

function messageForIssue(kind: PriceCoverageIssue["kind"]) {
  const messages: Record<PriceCoverageIssue["kind"], string> = {
    missing_base_price:
      "No hay precio lista publicado para la combinación activa de oferta.",
    offering_without_pricing_plan:
      "La oferta activa no declara planes de precio utilizables.",
    unresolvable_offering_context:
      "La oferta activa no tiene línea o modalidad canónica resoluble.",
  };

  return messages[kind];
}

function buildIssue(
  context: Pick<
    PriceCoverageContext,
    | "offeringId"
    | "cycle"
    | "campusName"
    | "programName"
    | "businessLine"
    | "modality"
    | "module"
    | "campusTier"
  >,
  plan: number | null,
  kind: Exclude<PriceCoverageIssue["kind"], "unresolvable_offering_context">,
): PriceCoverageIssue {
  return {
    kind,
    offeringId: context.offeringId,
    cycle: context.cycle,
    campus: context.campusName,
    program: context.programName,
    businessLine: context.businessLine,
    modality: context.modality,
    plan,
    module: context.module,
    tier: context.campusTier,
    message: messageForIssue(kind),
  };
}

function buildUnresolvableIssue(input: {
  offeringId: string;
  cycle: string;
  campus: string;
  program: string;
  businessLine: string | null;
  modality: string | null;
  module: string | null;
  tier: string | null;
}): PriceCoverageIssue {
  return {
    kind: "unresolvable_offering_context",
    offeringId: input.offeringId,
    cycle: input.cycle,
    campus: input.campus,
    program: input.program,
    businessLine: input.businessLine,
    modality: input.modality,
    plan: null,
    module: input.module,
    tier: input.tier,
    message: messageForIssue("unresolvable_offering_context"),
  };
}

/**
 * Uses the same base-price matcher used by the quote engine. Active offers
 * with unresolved canonical context are included as explicit issues instead
 * of being silently excluded from the report.
 */
export function inspectPriceCoverage(params: {
  contexts: PriceCoverageContext[];
  overrides: PriceOverrideSnapshot[];
  unresolvedIssues?: PriceCoverageIssue[];
}): Omit<PriceCoverageReport, "generatedAt" | "cycle"> {
  const issues = [...(params.unresolvedIssues ?? [])];
  const offeringIds = new Set(
    params.contexts.map((context) => context.offeringId),
  );

  for (const issue of params.unresolvedIssues ?? []) {
    offeringIds.add(issue.offeringId);
  }

  let combinationsChecked = 0;
  let coveredCombinations = 0;

  for (const context of params.contexts) {
    const plans = context.pricingPlans.filter(
      (plan) => Number.isInteger(plan) && plan > 0,
    );

    if (!plans.length) {
      issues.push(buildIssue(context, null, "offering_without_pricing_plan"));
      continue;
    }

    for (const plan of plans) {
      combinationsChecked += 1;
      const price = findPublishedBasePriceOverride(params.overrides, {
        businessLine: context.businessLine,
        modality: context.modality,
        plan,
        tier: context.campusTier,
        campus: context.campusName,
        campusAliases: context.campusAliases ?? [
          context.campusId,
          context.campusKey,
          context.campusName,
        ],
        programId: context.programId,
        programName: context.programName,
        programAliases: context.programAliases ?? [
          context.programId,
          context.programName,
        ],
        module: context.module,
      });

      if (price === null) {
        issues.push(buildIssue(context, plan, "missing_base_price"));
      } else {
        coveredCombinations += 1;
      }
    }
  }

  return {
    offeringsChecked: offeringIds.size,
    combinationsChecked,
    coveredCombinations,
    issues,
  };
}

export async function listActivePriceCoverageInputs(
  cycle: string | null,
): Promise<ActivePriceCoverageInputs> {
  const offerings = await prisma.programOffering.findMany({
    where: {
      isActive: true,
      campus: { isActive: true },
      ...(cycle ? { cycle } : {}),
    },
    select: {
      id: true,
      cycle: true,
      track: true,
      lineOfBusiness: true,
      pricingPlans: true,
      delivery: true,
      escolarizado: true,
      ejecutivo: true,
      campus: {
        select: {
          id: true,
          code: true,
          metaKey: true,
          name: true,
          slug: true,
          tier: true,
          kind: true,
        },
      },
      program: {
        select: {
          id: true,
          name: true,
          nameNormalized: true,
          businessLine: true,
          level: true,
          category: true,
        },
      },
    },
    orderBy: [{ cycle: "asc" }, { updatedAt: "desc" }],
  });

  const contexts: PriceCoverageContext[] = [];
  const unresolvedIssues: PriceCoverageIssue[] = [];

  for (const offering of offerings) {
    const businessLine =
      normalizeBusinessLine(offering.lineOfBusiness) ??
      normalizeBusinessLine(offering.program.businessLine) ??
      normalizeBusinessLine(offering.program.level) ??
      normalizeBusinessLine(offering.program.category);

    const modalities: CanonicalModalityValue[] =
      offering.delivery === "ONLINE"
        ? ["online"]
        : [
            ...(offering.escolarizado || !offering.ejecutivo
              ? (["presencial"] as const)
              : []),
            ...(offering.ejecutivo ? (["mixta"] as const) : []),
          ];

    const module = academicModuleOrDefault(offering.track);

    if (!businessLine || !modalities.length) {
      unresolvedIssues.push(
        buildUnresolvableIssue({
          offeringId: offering.id,
          cycle: offering.cycle,
          campus: offering.campus.name,
          program: offering.program.name,
          businessLine: businessLine ?? null,
          modality: modalities[0] ?? null,
          module,
          tier: offering.campus.tier,
        }),
      );
      continue;
    }

    const campusAliases = Array.from(
      new Set([
        offering.campus.id,
        offering.campus.code,
        offering.campus.metaKey,
        offering.campus.name,
        offering.campus.slug,
      ]),
    );

    for (const modality of modalities) {
      contexts.push({
        offeringId: offering.id,
        cycle: offering.cycle,
        businessLine,
        modality,
        programId: offering.program.id,
        programName: offering.program.name,
        campusId: offering.campus.id,
        campusKey:
          modality === "online" ||
          offering.campus.kind === "online" ||
          offering.campus.code === "ONLINE"
            ? "ONLINE"
            : offering.campus.metaKey ||
              offering.campus.name ||
              offering.campus.code,
        campusName: offering.campus.name,
        campusTier: offering.campus.tier,
        pricingPlans: normalizeAcademicPricingPlans(offering.pricingPlans),
        module,
        campusAliases,
        programAliases: [
          offering.program.id,
          offering.program.name,
          offering.program.nameNormalized,
        ],
      });
    }
  }

  return { contexts, unresolvedIssues };
}

export async function getPublishedPriceCoverageReport(params?: {
  cycle?: string | null;
}): Promise<PriceCoverageReport> {
  const cycle = params?.cycle?.trim() || null;
  const [coverageInputs, overrides] = await Promise.all([
    listActivePriceCoverageInputs(cycle),
    listActivePublishedPriceOverrides([BASE_PRICE_OVERRIDE_SCOPE]),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    cycle,
    ...inspectPriceCoverage({
      contexts: coverageInputs.contexts,
      unresolvedIssues: coverageInputs.unresolvedIssues,
      overrides,
    }),
  };
}
