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

function getCachedPlanesPayload(lineRaw: string, query: string) {
  return unstable_cache(
    () => loadPlanesPayload(lineRaw, query),
    [
      "public-planes",
      normalizePublicCacheKeyPart(lineRaw),
      normalizePublicCacheKeyPart(query),
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

    const payload = await getCachedPlanesPayload(lineRaw, query);
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
      },
    });
  }
}
