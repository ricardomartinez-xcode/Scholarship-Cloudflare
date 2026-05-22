import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { getMetaWhatsappConnectionSummary, getMetaEnvironmentAudit } from "@/lib/meta-whatsapp";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function GET() {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json({ ok: false, error: session.status }, { status: statusCodeForSessionState(session.status) });
  }

  const connection = await getMetaWhatsappConnectionSummary(session.user.id);
  return NextResponse.json({ ok: true, connection, environment: getMetaEnvironmentAudit() });
}
