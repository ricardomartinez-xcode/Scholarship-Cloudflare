import { NextResponse } from "next/server";

import { getCachedPublicCampusSnapshot } from "@/lib/campus";
import {
  buildPublicRequestId,
  logPublicRouteTiming,
} from "@/lib/public-route-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = buildPublicRequestId("/api/public/campuses");
  const startedAt = Date.now();
  let statusCode = 200;

  try {
    const { campuses, integrity } = await getCachedPublicCampusSnapshot();
    if (integrity.available && !integrity.ok) {
      console.warn("[campus] Active catalog is incomplete.", {
        activeCampus: integrity.activeCampus,
        activeOnline: integrity.activeOnline,
      });
    }
    return NextResponse.json({ campuses, integrity });
  } catch (error) {
    statusCode = 500;
    throw error;
  } finally {
    logPublicRouteTiming({
      route: "/api/public/campuses",
      requestId,
      startedAt,
      statusCode,
    });
  }
}
