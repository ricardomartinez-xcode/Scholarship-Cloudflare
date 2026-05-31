import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { getAcademicOfferVisibleCycles } from "@/lib/academic-offer-config";
import { getSessionUser } from "@/lib/authz";
import {
  normalizeAcademicOfferCycle,
  type AcademicOfferCycle,
} from "@/config/academicOffer";
import { prisma } from "@/lib/prisma";
import {
  buildPublicRequestId,
  logPublicRouteTiming,
  normalizePublicCacheKeyPart,
  PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
  PUBLIC_ROUTE_CACHE_TAGS,
} from "@/lib/public-route-cache";
import { normalizeCanonicalModality } from "@/lib/pricing-normalize";
import { normalizeKey } from "@/lib/text-normalize";
import {
  getUnidepProgramCatalog,
  getUnidepProgramPlanUrl,
  matchesUnidepProgramLine,
  normalizeUnidepProgramBusinessLine,
} from "@/lib/unidep-program-catalog";
import {
  listFileAssetAssignmentsForTargets,
  resolveProgramR2AssetPayload,
  type PublicFileAssetPayload,
} from "@/lib/file-assets";

export const dynamic = "force-dynamic";

function getModalityLabel(offering: {
  delivery: "CAMPUS" | "ONLINE";
  escolarizado: boolean;
  ejecutivo: boolean;
}) {
  if (offering.delivery === "ONLINE") return "Online";
  if (offering.escolarizado && offering.ejecutivo) return "Escolarizado / Ejecutivo";
  if (offering.ejecutivo) return "Ejecutivo";
  if (offering.escolarizado) return "Escolarizado";
  return "Presencial";
}

type OfertaPayload = {
  availableCycles: string[];
  selectedCycle: string | null;
  campuses: Array<{
    id: string;
    code: string;
    metaKey: string;
    name: string;
    slug: string;
    tier: string | null;
    kind: "campus" | "online";
  }>;
  programs: Array<{
    programId: string;
    name: string;
    category: string | null;
    businessLine: string | null;
    brochurePdfUrl: string | null;
    planPdfUrl: string | null;
    heroImageUrl: string | null;
    planDownloadUrl: string | null;
    brochureDownloadUrl: string | null;
    r2Assets: {
      studyPlan: PublicFileAssetPayload | null;
      brochure: PublicFileAssetPayload | null;
      heroImage: PublicFileAssetPayload | null;
    };
  }>;
  offerings: Array<{
    id: string;
    modality: string;
    schedule: string | null;
    planLink: string | null;
    planDownloadLink: string | null;
    pricingPlans: number[];
    campus: {
      id: string;
      code: string;
      metaKey: string;
      name: string;
      slug: string;
      tier: string | null;
      kind: "campus" | "online";
    };
    program: { id: string; name: string };
  }>;
};

type OfertaOfferingPayload = OfertaPayload["offerings"][number];
type OfertaCampusPayload = OfertaPayload["campuses"][number];

function getOfferingCanonicalModalities(offering: {
  delivery: "CAMPUS" | "ONLINE";
  escolarizado: boolean;
  ejecutivo: boolean;
}): Array<"online" | "presencial" | "mixta"> {
  if (offering.delivery === "ONLINE") return ["online"];
  const modalities = new Set<"online" | "presencial" | "mixta">();
  if (offering.escolarizado) modalities.add("presencial");
  if (offering.ejecutivo) modalities.add("mixta");
  if (!offering.escolarizado && !offering.ejecutivo) modalities.add("presencial");
  return Array.from(modalities);
}

function buildCampusPayload(campus: {
  id: string;
  code: string;
  metaKey: string;
  name: string;
  slug: string;
  tier: string | null;
  kind: "campus" | "online";
}): OfertaCampusPayload {
  return {
    id: campus.id,
    code: campus.code,
    metaKey: campus.metaKey,
    name: campus.name,
    slug: campus.slug,
    tier: campus.tier,
    kind: campus.kind,
  };
}

function resolveRequestedCycle(
  cycleRaw: string,
  availableCycles: AcademicOfferCycle[],
): AcademicOfferCycle | null {
  const normalized = normalizeAcademicOfferCycle(cycleRaw);
  if (normalized) return normalized;
  if (cycleRaw) return null;
  return availableCycles[0] ?? null;
}

async function loadOfertaPayload(
  campusRaw: string,
  lineRaw: string,
  modalityRaw: string,
  cycleRaw: string,
): Promise<OfertaPayload> {
  const availableCycles = await getAcademicOfferVisibleCycles();
  const requestedCycle = resolveRequestedCycle(cycleRaw, availableCycles);
  const requestedModality = normalizeCanonicalModality(modalityRaw);
  if (!requestedCycle) {
    return { availableCycles, selectedCycle: null, campuses: [], programs: [], offerings: [] };
  }
  if (!availableCycles.includes(requestedCycle)) {
    return { availableCycles, selectedCycle: null, campuses: [], programs: [], offerings: [] };
  }

  let campusId: string | null = null;
  if (campusRaw) {
    const campus = await prisma.campus.findFirst({
      where: {
        isActive: true,
        OR: [
          { code: { equals: campusRaw, mode: "insensitive" } },
          { metaKey: { equals: campusRaw, mode: "insensitive" } },
          { name: { equals: campusRaw, mode: "insensitive" } },
          { slug: { equals: campusRaw, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (campus) {
      campusId = campus.id;
    } else {
      const normalized = normalizeKey(campusRaw);
      const all = await prisma.campus.findMany({
        where: { isActive: true },
        select: { id: true, code: true, metaKey: true, name: true, slug: true },
      });
      const match = all.find(
        (item) =>
          normalizeKey(item.code) === normalized ||
          normalizeKey(item.metaKey) === normalized ||
          normalizeKey(item.name) === normalized ||
          normalizeKey(item.slug) === normalized,
      );
      if (match) campusId = match.id;
    }
    if (!campusId) {
      return {
        availableCycles,
        selectedCycle: requestedCycle,
        campuses: [],
        programs: [],
        offerings: [],
      };
    }
  }

  const catalog = await getUnidepProgramCatalog();
  const programMap = new Map(catalog.map((program) => [program.id, program]));
  const r2Assignments = await listFileAssetAssignmentsForTargets(
    "program",
    catalog.map((program) => program.id),
  );
  const lineEnum = normalizeUnidepProgramBusinessLine(lineRaw);
  const normalizedLineRaw = normalizeKey(lineRaw);

  const offeringWhere = {
    isActive: true,
    cycle: requestedCycle,
    ...(campusId ? { campusId } : {}),
    ...(lineRaw
      ? {
          OR: [
            { lineOfBusiness: { equals: lineRaw, mode: "insensitive" as const } },
            ...(normalizedLineRaw !== lineRaw.toLowerCase()
              ? [{ lineOfBusiness: { equals: normalizedLineRaw, mode: "insensitive" as const } }]
              : []),
            ...(lineEnum ? [{ program: { businessLine: lineEnum } }] : []),
            {
              program: {
                level: { equals: lineRaw, mode: "insensitive" as const },
              },
            },
            {
              program: {
                category: { contains: lineRaw, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };

  const offeringsRaw = await prisma.programOffering.findMany({
    where: offeringWhere,
    orderBy: [{ program: { name: "asc" } }],
    select: {
      id: true,
      programId: true,
      delivery: true,
      escolarizado: true,
      ejecutivo: true,
      escolarizadoSchedule: true,
      ejecutivoSchedule: true,
      lineOfBusiness: true,
      pricingPlans: true,
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
    },
  });

  const filteredOfferings = offeringsRaw.filter((offering) => {
    const program = programMap.get(offering.programId);
    if (!program) return false;
    if (
      requestedModality &&
      !getOfferingCanonicalModalities(offering).includes(requestedModality)
    ) {
      return false;
    }
    if (!lineRaw) return true;
    return (
      normalizeKey(offering.lineOfBusiness ?? "") === normalizedLineRaw ||
      (lineEnum !== null &&
        normalizeUnidepProgramBusinessLine(offering.lineOfBusiness) === lineEnum) ||
      matchesUnidepProgramLine(program, lineRaw)
    );
  });

  const seen = new Set<string>();
  const campusMap = new Map<string, OfertaCampusPayload>();
  const programs: OfertaPayload["programs"] = [];

  for (const offering of filteredOfferings) {
    campusMap.set(offering.campus.id, buildCampusPayload(offering.campus));
    if (seen.has(offering.programId)) continue;
    const program = programMap.get(offering.programId);
    if (!program) continue;
    seen.add(offering.programId);
    const r2Payload = resolveProgramR2AssetPayload({
      programId: program.id,
      planPdfUrl: getUnidepProgramPlanUrl(program),
      brochurePdfUrl: program.brochurePdfUrl ?? null,
      assets: r2Assignments.get(program.id) ?? {},
    });
    programs.push({
      programId: program.id,
      name: program.name,
      category: program.category,
      businessLine: program.businessLine,
      brochurePdfUrl: r2Payload.brochurePdfUrl,
      planPdfUrl: r2Payload.planPdfUrl,
      heroImageUrl: r2Payload.heroImageUrl,
      planDownloadUrl: r2Payload.planDownloadUrl,
      brochureDownloadUrl: r2Payload.brochureDownloadUrl,
      r2Assets: r2Payload.r2Assets,
    });
  }

  programs.sort((left, right) => left.name.localeCompare(right.name, "es"));

  const offerings = filteredOfferings
    .map((offering) => {
      const program = programMap.get(offering.programId);
      if (!program) return null;
      const r2Payload = resolveProgramR2AssetPayload({
        programId: program.id,
        planPdfUrl: getUnidepProgramPlanUrl(program),
        brochurePdfUrl: program.brochurePdfUrl ?? null,
        assets: r2Assignments.get(program.id) ?? {},
      });
      return {
        id: offering.id,
        modality: getModalityLabel(offering),
        schedule: offering.escolarizadoSchedule ?? offering.ejecutivoSchedule ?? null,
        planLink: r2Payload.planPdfUrl,
        planDownloadLink: r2Payload.planDownloadUrl,
        pricingPlans: offering.pricingPlans ?? [],
        campus: buildCampusPayload(offering.campus),
        program: { id: program.id, name: program.name },
      };
    })
    .filter((offering): offering is OfertaOfferingPayload => Boolean(offering));

  return {
    availableCycles,
    selectedCycle: requestedCycle,
    campuses: Array.from(campusMap.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "es"),
    ),
    programs,
    offerings,
  };
}

function getCachedOfertaPayload(
  campusRaw: string,
  lineRaw: string,
  modalityRaw: string,
  cycleRaw: string,
) {
  return unstable_cache(
    () => loadOfertaPayload(campusRaw, lineRaw, modalityRaw, cycleRaw),
    [
      "public-oferta",
      normalizePublicCacheKeyPart(campusRaw),
      normalizePublicCacheKeyPart(lineRaw),
      normalizePublicCacheKeyPart(modalityRaw),
      normalizePublicCacheKeyPart(cycleRaw),
    ],
    {
      revalidate: PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
      tags: [PUBLIC_ROUTE_CACHE_TAGS.oferta],
    },
  )();
}

export async function GET(request: Request) {
  const requestId = buildPublicRequestId("/api/public/oferta");
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const campusRaw = (searchParams.get("campus") ?? "").trim();
  const lineRaw = (searchParams.get("line") ?? "").trim();
  const modalityRaw = (searchParams.get("modality") ?? "").trim();
  const cycleRaw = (searchParams.get("cycle") ?? "").trim();

  let statusCode = 200;
  let actorUserId: string | null = null;
  let actorEmail: string | null = null;

  try {
    const auth = await getSessionUser();
    if (auth.status === "unauthenticated") {
      statusCode = 401;
      return NextResponse.json({ error: "unauthenticated" }, { status: statusCode });
    }
    if (auth.status === "forbidden") {
      statusCode = 403;
      return NextResponse.json({ error: "forbidden" }, { status: statusCode });
    }

    actorUserId = auth.user.id;
    actorEmail = auth.email;

    const payload = await getCachedOfertaPayload(
      campusRaw,
      lineRaw,
      modalityRaw,
      cycleRaw,
    );
    return NextResponse.json(payload);
  } catch (error) {
    statusCode = 500;
    throw error;
  } finally {
    logPublicRouteTiming({
      route: "/api/public/oferta",
      requestId,
      startedAt,
      statusCode,
      actorUserId,
      actorEmail,
      metadata: {
        campus: campusRaw || null,
        line: lineRaw || null,
        modality: modalityRaw || null,
        cycle: cycleRaw || null,
      },
    });
  }
}
