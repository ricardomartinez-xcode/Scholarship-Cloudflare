import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { syncNeonAuthWebhook } from "@/lib/neon-auth-admin";

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { events?: string[] };
    const result = await syncNeonAuthWebhook(request.nextUrl.origin, body.events);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar Neon Auth webhook." },
      { status: 500 },
    );
  }
}
