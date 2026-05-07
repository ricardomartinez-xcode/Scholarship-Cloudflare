import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

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

async function loadCostosPayload(campusRaw: string) {
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
    if (campus) campusId = campus.id;
  }

  const campusFees = campusId
    ? await prisma.campusAcademicFee.findMany({
        where: { campusId, isActive: true },
        select: {
          overrideCostMxn: true,
          fee: {
            select: {
              id: true,
              code: true,
              concept: true,
              costMxn: true,
              section: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ fee: { section: "asc" } }, { fee: { concept: "asc" } }],
      })
    : [];

  const bulletins = await prisma.bulletin.findMany({
    where: campusRaw
      ? {
          campus: {
            OR: [
              { code: { equals: campusRaw, mode: "insensitive" } },
              { metaKey: { equals: campusRaw, mode: "insensitive" } },
              { name: { equals: campusRaw, mode: "insensitive" } },
              { slug: { equals: campusRaw, mode: "insensitive" } },
            ],
          },
        }
      : {},
    orderBy: [{ campus: { name: "asc" } }, { fileName: "asc" }],
    select: {
      id: true,
      cycle: true,
      fileName: true,
      filePath: true,
      campus: {
        select: { id: true, code: true, metaKey: true, name: true, slug: true },
      },
    },
  });

  const fees = campusFees.map((cf) => ({
    id: cf.fee.id,
    code: cf.fee.code,
    concept: cf.fee.concept,
    costMxn: cf.overrideCostMxn ?? cf.fee.costMxn,
    section: cf.fee.section,
  }));

  return { fees, bulletins };
}

function getCachedCostosPayload(campusRaw: string) {
  return unstable_cache(
    () => loadCostosPayload(campusRaw),
    ["public-costos", normalizePublicCacheKeyPart(campusRaw)],
    {
      revalidate: PUBLIC_ROUTE_CACHE_REVALIDATE_SECONDS,
      tags: [PUBLIC_ROUTE_CACHE_TAGS.costos],
    },
  )();
}

export async function GET(request: Request) {
  const requestId = buildPublicRequestId("/api/public/costos");
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const campusRaw = (searchParams.get("campus") ?? "").trim();

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

    const payload = await getCachedCostosPayload(campusRaw);
    return NextResponse.json(payload);
  } catch (error) {
    statusCode = 500;
    throw error;
  } finally {
    logPublicRouteTiming({
      route: "/api/public/costos",
      requestId,
      startedAt,
      statusCode,
      actorUserId,
      actorEmail,
      metadata: {
        campus: campusRaw || null,
      },
    });
  }
}
