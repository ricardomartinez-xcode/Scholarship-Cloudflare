import { BusinessEventType } from "@prisma/client";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { writeBusinessEventSafe } from "@/lib/business-events";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        campaignName?: string;
        status?: string;
        meta?: unknown;
      }
    | null;

  const runId = crypto.randomUUID();
  const campaignName = String(body?.campaignName ?? "").trim() || "WhatsApp handoff";
  const status = String(body?.status ?? "").trim() || "queued";

  await writeBusinessEventSafe({
    type: BusinessEventType.EXTENSION_RUN_CREATED,
    userId: session.user.id,
    subjectType: "extension_run",
    subjectId: runId,
    metadata: {
      campaignName,
      status,
      clientSurface: "chrome_side_panel",
      meta: body?.meta ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    runId,
    campaignName,
    status,
  });
}
