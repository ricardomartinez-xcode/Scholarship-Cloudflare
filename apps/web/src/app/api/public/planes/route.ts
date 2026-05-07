import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { BenefitBusinessLine } from "@prisma/client";

import { getSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buildPublicRequestId,
  logPublicRouteTiming,
  normalizePublicCacheKeyPart,
  PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
  PUBLIC_ROUTE_CACHE_TAGS,
} from "@/lib/public-route-cache";

export const dynamic = "force-dynamic";

const VALID_LINES = ["salud", "licenciatura", "prepa", "posgrado"] as const;

async function loadPlanesPayload(lineRaw: string, query: string) {
  const lineEnum = VALID_LINES.includes(lineRaw as (typeof VALID_LINES)[number])
    ? (lineRaw as BenefitBusinessLine)
    : null;

  const andConditions: object[] = [
    {
      OR: [
        { planPdfUrl: { not: null } },
        { planDriveLink: { not: null } },
        { planUrl: { not: null } },
      ],
    },
  ];

  if (lineEnum) {
    andConditions.push({ businessLine: lineEnum });
  }

  if (query) {
    andConditions.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  const programs = await prisma.program.findMany({
    where: { AND: andConditions },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      businessLine: true,
      planPdfUrl: true,
      planDriveLink: true,
      planUrl: true,
      _count: { select: { offerings: true } },
    },
    take: 400,
  });

  return {
    programs: programs.map((program) => ({
      id: program.id,
      name: program.name,
      category: program.category,
      businessLine: program.businessLine,
      planPdfUrl: program.planPdfUrl ?? program.planDriveLink ?? program.planUrl ?? null,
      hasPlan: Boolean(program.planPdfUrl ?? program.planDriveLink ?? program.planUrl),
      _count: program._count,
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
