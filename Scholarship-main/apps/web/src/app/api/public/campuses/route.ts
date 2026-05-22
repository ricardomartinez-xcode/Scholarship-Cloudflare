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
    if (!integrity.ok) {
      // No autocreate in production. Seed is explicit.
      console.warn(
        "[campus] Catalog incomplete. Run `npm run campus:seed`.",
        integrity
      );
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
