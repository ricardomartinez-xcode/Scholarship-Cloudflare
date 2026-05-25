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
import { normalizeCanonicalModality } from "@/lib/pricing-normalize";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getOfferedProgramIds(params: {
  campus: string;
  cycle: string;
  modality: string;
}) {
  const campus = params.campus.trim();
  const cycle = params.cycle.trim();
  if (!campus || !cycle) return null;

  const modality = normalizeCanonicalModality(params.modality);
  const modalityWhere =
    modality === "online"
      ? { delivery: "ONLINE" as const }
      : modality === "mixta"
        ? { delivery: "CAMPUS" as const, ejecutivo: true }
        : modality === "presencial"
          ? {
              delivery: "CAMPUS" as const,
              OR: [{ escolarizado: true }, { ejecutivo: false }],
            }
          : {};

  const offerings = await prisma.programOffering.findMany({
    where: {
      isActive: true,
      cycle,
      campus: {
        isActive: true,
        OR: [{ metaKey: campus }, { code: campus }, { name: campus }],
      },
      ...modalityWhere,
    },
    select: { programId: true },
  });

  return new Set(offerings.map((offering) => offering.programId));
}

async function loadPlanesPayload(params: {
  lineRaw: string;
  query: string;
  campus: string;
  cycle: string;
  modality: string;
}) {
  const programs = await getUnidepProgramCatalog({
    businessLine: params.lineRaw,
    query: params.query,
    onlyWithPlan: true,
  });
  const offeredProgramIds = await getOfferedProgramIds(params);
  const visiblePrograms = offeredProgramIds
    ? programs.filter((program) => offeredProgramIds.has(program.id))
    : programs;

  return {
    programs: visiblePrograms.map((program) => ({
      id: program.id,
      name: program.name,
      category: program.category,
      businessLine: program.businessLine,
      planPdfUrl: getUnidepProgramPlanUrl(program),
      hasPlan: Boolean(getUnidepProgramPlanUrl(program)),
    })),
  };
}

function getCachedPlanesPayload(params: {
  lineRaw: string;
  query: string;
  campus: string;
  cycle: string;
  modality: string;
}) {
  return unstable_cache(
    () => loadPlanesPayload(params),
    [
      "public-planes",
      normalizePublicCacheKeyPart(params.lineRaw),
      normalizePublicCacheKeyPart(params.query),
      normalizePublicCacheKeyPart(params.campus),
      normalizePublicCacheKeyPart(params.cycle),
      normalizePublicCacheKeyPart(params.modality),
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
  const campus = (searchParams.get("campus") ?? "").trim();
  const cycle = (searchParams.get("cycle") ?? "").trim();
  const modality = (searchParams.get("modality") ?? "").trim();

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

    const payload = await getCachedPlanesPayload({
      lineRaw,
      query,
      campus,
      cycle,
      modality,
    });
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
        campus: campus || null,
        cycle: cycle || null,
        modality: modality || null,
      },
    });
  }
}
