import { NextResponse } from "next/server";

import { getAdminAccessState } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getAdminAccessState();
  if (state.status !== "ok") {
    return NextResponse.json(
      { ok: false, status: state.status, capabilities: [] },
      { status: 200, headers: { "Cache-Control": "no-store, private" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      status: "ok",
      role: state.user.role,
      capabilities: state.user.capabilities,
    },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
