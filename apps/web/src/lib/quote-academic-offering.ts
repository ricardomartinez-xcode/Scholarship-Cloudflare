import { prisma } from "@/lib/prisma";
import {
  normalizeBusinessLine,
  normalizeCanonicalModality,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
} from "@/lib/pricing-normalize";
import { normalizeKey } from "@/lib/text-normalize";
import { academicPlanIsAllowed, normalizeAcademicPricingPlans } from "@/lib/academic-offer-plans";

type OfferingRow = {
  id: string;
  cycle: string;
  lineOfBusiness: string | null;
  pricingPlans: number[];
  delivery: "CAMPUS" | "ONLINE";
  escolarizado: boolean;
  ejecutivo: boolean;
  campus: {
    id: string;
    code: string;
    metaKey: string;
    name: string;
    slug: string;
    tier: string | null;
    kind: "campus" | "online";
  };
  program: {
    id: string;
    name: string;
    businessLine: CanonicalBusinessLine | null;
    level: string | null;
    category: string | null;
  };
};

export type QuoteAcademicOfferingContext = {
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
};

export type QuoteAcademicOfferingResolution =
  | {
      ok: true;
      context: QuoteAcademicOfferingContext | null;
      warnings: string[];
    }
  | {
      ok: false;
      error: "invalid_offering";
      hint: string;
      warnings: string[];
    };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function campusLookupWhere(campus: string) {
  const value = campus.trim();
  if (!value) return null;
  return {
    OR: [
      ...(isUuid(value) ? [{ id: value }] : []),
      { code: { equals: value, mode: "insensitive" as const } },
      { metaKey: { equals: value, mode: "insensitive" as const } },
      { name: { equals: value, mode: "insensitive" as const } },
      { slug: { equals: value, mode: "insensitive" as const } },
    ],
  };
}

function offeringSelect() {
  return {
    id: true,
    cycle: true,
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
        businessLine: true,
        level: true,
        category: true,
      },
    },
  } as const;
}

function getOfferingModalities(offering: {
  delivery: "CAMPUS" | "ONLINE";
  escolarizado: boolean;
  ejecutivo: boolean;
}): CanonicalModalityValue[] {
  if (offering.delivery === "ONLINE") return ["online"];

  const modalities = new Set<CanonicalModalityValue>();
  if (offering.escolarizado || !offering.ejecutivo) modalities.add("presencial");
  if (offering.ejecutivo) modalities.add("mixta");
  return Array.from(modalities);
}

function resolveOfferingBusinessLine(offering: Pick<OfferingRow, "lineOfBusiness" | "program">) {
  return (
    normalizeBusinessLine(offering.lineOfBusiness) ??
    normalizeBusinessLine(offering.program.businessLine) ??
    normalizeBusinessLine(offering.program.level) ??
    normalizeBusinessLine(offering.program.category)
  );
}

function resolveOfferingModality(
  offering: Pick<OfferingRow, "delivery" | "escolarizado" | "ejecutivo">,
  requestedModality: CanonicalModalityValue | string | null | undefined,
) {
  const available = getOfferingModalities(offering);
  const normalizedRequested = normalizeCanonicalModality(requestedModality);

  if (normalizedRequested && available.includes(normalizedRequested)) {
    return normalizedRequested;
  }

  return available.length === 1 ? available[0] : null;
}

function buildCampusKey(campus: OfferingRow["campus"], modality: CanonicalModalityValue) {
  if (modality === "online" || campus.kind === "online" || campus.code === "ONLINE") {
    return "ONLINE";
  }

  return campus.metaKey || campus.name || campus.code;
}

function buildContext(
  offering: OfferingRow,
  requestedModality: CanonicalModalityValue | string | null | undefined,
): QuoteAcademicOfferingContext | null {
  const businessLine = resolveOfferingBusinessLine(offering);
  const modality = resolveOfferingModality(offering, requestedModality);

  if (!businessLine || !modality) return null;

  return {
    offeringId: offering.id,
    cycle: offering.cycle,
    businessLine,
    modality,
    programId: offering.program.id,
    programName: offering.program.name,
    campusId: offering.campus.id,
    campusKey: buildCampusKey(offering.campus, modality),
    campusName: offering.campus.name,
    campusTier: offering.campus.tier,
    pricingPlans: normalizeAcademicPricingPlans(offering.pricingPlans),
  };
}

function offeringMatchesRequest(
  offering: OfferingRow,
  input: {
    businessLine?: string | null;
    modality?: string | null;
    selectedProgramId?: string | null;
    campus?: string | null;
    plan?: number | string | null;
  },
) {
  const warnings: string[] = [];
  const context = buildContext(offering, input.modality);
  if (!context) {
    return { matches: false, warnings: ["offering_context_unresolvable"], context: null };
  }

  const requestedBusinessLine = normalizeBusinessLine(input.businessLine);
  if (requestedBusinessLine && requestedBusinessLine !== context.businessLine) {
    warnings.push("business_line_mismatch");
  }

  const requestedModality = normalizeCanonicalModality(input.modality);
  if (requestedModality && requestedModality !== context.modality) {
    warnings.push("modality_mismatch");
  }

  if (input.selectedProgramId && input.selectedProgramId !== context.programId) {
    warnings.push("program_mismatch");
  }

  if (input.campus) {
    const requestedCampus = normalizeKey(input.campus);
    const campusKeys = [
      offering.campus.id,
      offering.campus.code,
      offering.campus.metaKey,
      offering.campus.name,
      offering.campus.slug,
      context.campusKey,
    ].map(normalizeKey);

    if (requestedCampus && !campusKeys.includes(requestedCampus)) {
      warnings.push("campus_mismatch");
    }
  }

  if (!academicPlanIsAllowed(offering.pricingPlans, input.plan)) {
    warnings.push("plan_not_available_for_offering");
  }

  return {
    matches: warnings.length === 0,
    warnings,
    context,
  };
}

export async function resolveQuoteAcademicOffering(input: {
  offeringId?: string | null;
  selectedProgramId?: string | null;
  campus?: string | null;
  businessLine?: string | null;
  modality?: string | null;
  plan?: number | string | null;
  cycle?: string | null;
}): Promise<QuoteAcademicOfferingResolution> {
  const warnings: string[] = [];
  const offeringId = input.offeringId?.trim() || null;
  const selectedProgramId = input.selectedProgramId?.trim() || null;

  if (offeringId) {
    if (!isUuid(offeringId)) {
      return {
        ok: false,
        error: "invalid_offering",
        hint: "La oferta académica seleccionada no tiene un identificador válido.",
        warnings: ["offering_id_invalid"],
      };
    }

    const offering = await prisma.programOffering.findFirst({
      where: {
        id: offeringId,
        isActive: true,
        campus: { isActive: true },
      },
      select: offeringSelect(),
    });

    if (!offering) {
      return {
        ok: false,
        error: "invalid_offering",
        hint:
          "La oferta académica seleccionada ya no está activa. Vuelve a seleccionar programa y plantel.",
        warnings: ["offering_not_found"],
      };
    }

    const match = offeringMatchesRequest(offering, input);
    if (match.warnings.length) warnings.push(...match.warnings);

    if (!match.context) {
      return {
        ok: false,
        error: "invalid_offering",
        hint: "No fue posible resolver la línea o modalidad de la oferta académica seleccionada.",
        warnings,
      };
    }

    return {
      ok: true,
      context: match.context,
      warnings,
    };
  }

  if (!selectedProgramId) {
    return { ok: true, context: null, warnings };
  }

  if (!isUuid(selectedProgramId)) {
    warnings.push("program_id_invalid");
    return { ok: true, context: null, warnings };
  }

  const campusWhere = input.campus ? campusLookupWhere(input.campus) : null;
  const campus = campusWhere
    ? await prisma.campus.findFirst({
        where: {
          isActive: true,
          ...campusWhere,
        },
        select: { id: true },
      })
    : null;

  if (input.campus && !campus) {
    warnings.push("campus_not_found");
    return { ok: true, context: null, warnings };
  }

  const requestedModality = normalizeCanonicalModality(input.modality);
  const requestedBusinessLine = normalizeBusinessLine(input.businessLine);
  const offeringCandidates = await prisma.programOffering.findMany({
    where: {
      isActive: true,
      programId: selectedProgramId,
      ...(campus ? { campusId: campus.id } : {}),
      ...(input.cycle ? { cycle: input.cycle } : {}),
      campus: { isActive: true },
    },
    orderBy: [{ cycle: "asc" }, { updatedAt: "desc" }],
    select: offeringSelect(),
  });

  const matchingOffering =
    offeringCandidates.find((offering) => {
      const context = buildContext(offering, requestedModality);
      if (!context) return false;
      if (requestedBusinessLine && context.businessLine !== requestedBusinessLine) return false;
      if (requestedModality && context.modality !== requestedModality) return false;
      if (!academicPlanIsAllowed(offering.pricingPlans, input.plan)) return false;
      return true;
    }) ?? null;

  if (!matchingOffering) {
    const hasPlanRestrictedCandidate = offeringCandidates.some((offering) => {
      const context = buildContext(offering, requestedModality);
      if (!context) return false;
      if (requestedBusinessLine && context.businessLine !== requestedBusinessLine) return false;
      if (requestedModality && context.modality !== requestedModality) return false;
      return !academicPlanIsAllowed(offering.pricingPlans, input.plan);
    });

    warnings.push(hasPlanRestrictedCandidate ? "plan_not_available_for_offering" : "offering_not_resolved");
    return { ok: true, context: null, warnings };
  }

  const context = buildContext(matchingOffering, requestedModality);
  if (!context) {
    warnings.push("offering_context_unresolvable");
    return { ok: true, context: null, warnings };
  }

  return { ok: true, context, warnings };
}
