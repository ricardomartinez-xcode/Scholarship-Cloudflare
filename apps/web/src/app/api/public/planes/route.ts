import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  buildPublicRequestId,
  logPublicRouteTiming,
  normalizePublicCacheKeyPart,
  PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
  PUBLIC_ROUTE_CACHE_TAGS,
} from "@/lib/public-route-cache";
import {
  getUnidepProgramCatalog,
  getUnidepProgramPlanUrl,
} from "@/lib/unidep-program-catalog";

export const dynamic = "force-dynamic";

async function loadPlanesPayload(lineRaw: string, query: string) {
  const programs = await getUnidepProgramCatalog({
    businessLine: lineRaw,
    query,
    onlyWithPlan: true,
  });

  const campuses = new Map<
    string,
    {
      id: string;
      code: string;
      metaKey: string;
      name: string;
      slug: string;
      tier: string | null;
      kind: "campus" | "online";
    }
  >();
  const programs = new Map<
    string,
    {
      id: string;
      name: string;
      category: string | null;
      businessLine: string | null;
      planPdfUrl: string | null;
      hasPlan: boolean;
      _count: { offerings: number };
      campuses: Array<{
        id: string;
        code: string;
        metaKey: string;
        name: string;
        slug: string;
        tier: string | null;
        kind: "campus" | "online";
      }>;
    }
  >();

  for (const offering of offerings) {
    if (
      normalizedModality &&
      !getOfferingCanonicalModalities(offering).includes(normalizedModality)
    ) {
      continue;
    }
    if (
      !matchesLineFilter(lineRaw, [
        offering.lineOfBusiness,
        lineEnum ? String(lineEnum) : null,
        offering.program.businessLine,
        offering.program.level,
        offering.program.category,
      ])
    ) {
      continue;
    }
    const planLink =
      offering.program.planPdfUrl ??
      offering.program.planDriveLink ??
      offering.program.planUrl ??
      null;
    if (!planLink) continue;

    const campus = {
      id: offering.campus.id,
      code: offering.campus.code,
      metaKey: offering.campus.metaKey,
      name: offering.campus.name,
      slug: offering.campus.slug,
      tier: offering.campus.tier,
      kind: offering.campus.kind,
    };
    campuses.set(campus.id, campus);

    const current = programs.get(offering.program.id);
    if (!current) {
      programs.set(offering.program.id, {
        id: offering.program.id,
        name: offering.program.name,
        category: offering.program.category,
        businessLine: offering.program.businessLine,
        planPdfUrl: planLink,
        hasPlan: true,
        _count: offering.program._count,
        campuses: [campus],
      });
      continue;
    }
    if (!current.campuses.some((item) => item.id === campus.id)) {
      current.campuses.push(campus);
    }
  }

  return {
    programs: programs.map((program) => ({
      id: program.id,
      name: program.name,
      category: program.category,
      businessLine: program.businessLine,
      planPdfUrl: getUnidepProgramPlanUrl(program),
      hasPlan: Boolean(getUnidepProgramPlanUrl(program)),
    })),
  };
}

function getCachedPlanesPayload(
  lineRaw: string,
  query: string,
  campusRaw: string,
  modalityRaw: string,
  cycleRaw: string,
) {
  return unstable_cache(
    () => loadPlanesPayload(lineRaw, query, campusRaw, modalityRaw, cycleRaw),
    [
      "public-planes",
      normalizePublicCacheKeyPart(lineRaw),
      normalizePublicCacheKeyPart(query),
      normalizePublicCacheKeyPart(campusRaw),
      normalizePublicCacheKeyPart(modalityRaw),
      normalizePublicCacheKeyPart(cycleRaw),
    ],
    {
      revalidate: PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
      tags: [PUBLIC_ROUTE_CACHE_TAGS.planes],
    },
  )();
}

export async function GET(request: Request) {
  const requestId = buildPublicRequestId("/api/public/planes");
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const lineRaw = (searchParams.get("line") ?? "").trim();
  const query = (searchParams.get("q") ?? "").trim();
  const campusRaw = (searchParams.get("campus") ?? "").trim();
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

    const payload = await getCachedPlanesPayload(
      lineRaw,
      query,
      campusRaw,
      modalityRaw,
      cycleRaw,
    );
    return NextResponse.json(payload);
  } catch (error) {
    statusCode = 500;
    throw error;
  } finally {
    logPublicRouteTiming({
      route: "/api/public/planes",
      requestId,
      startedAt,
      statusCode,
      actorUserId,
      actorEmail,
      metadata: {
        line: lineRaw || null,
        query: query || null,
        campus: campusRaw || null,
        modality: modalityRaw || null,
        cycle: cycleRaw || null,
      },
    });
  }
}
