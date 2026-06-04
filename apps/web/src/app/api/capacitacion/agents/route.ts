import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { listRoleplayAgentDefinitions } from "@/lib/training-roleplay-agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (session.status !== "ok" || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    agents: listRoleplayAgentDefinitions(),
  });
}
