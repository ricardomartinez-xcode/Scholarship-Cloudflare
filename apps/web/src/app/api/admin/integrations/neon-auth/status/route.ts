import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { getRecentNeonAuthEvents } from "@/lib/neon-auth-event-log";
import { getNeonAuthAdminStatus } from "@/lib/neon-auth-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = await getNeonAuthAdminStatus(request.nextUrl.origin);
  return NextResponse.json({ ...status, recentEvents: getRecentNeonAuthEvents() });
}
