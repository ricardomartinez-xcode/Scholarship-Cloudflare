import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { getMetaWhatsappOverview } from "@/lib/meta-whatsapp";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const { searchParams } = new URL(request.url);
  const sync = searchParams.get("sync") === "1";

  try {
    const overview = await getMetaWhatsappOverview(session.user.id, { forceSync: sync });
    return NextResponse.json({ ok: true, overview });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "meta_overview_failed",
      },
      { status: 500 },
    );
  }
}
