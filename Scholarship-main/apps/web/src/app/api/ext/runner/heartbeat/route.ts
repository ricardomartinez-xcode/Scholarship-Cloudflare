import { BusinessEventType } from "@prisma/client";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { writeBusinessEventSafe } from "@/lib/business-events";
import { getExtensionRunnerHealth } from "@/lib/extension-automation";

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
        runId?: string | null;
        campaignId?: string | null;
        status?: string | null;
        message?: string | null;
        meta?: Record<string, unknown> | null;
      }
    | null;

  const runId = String(body?.runId ?? "").trim();
  const campaignId = String(body?.campaignId ?? "").trim();
  const status = String(body?.status ?? "").trim() || null;
  const message = String(body?.message ?? "").trim() || null;

  await writeBusinessEventSafe({
    type: BusinessEventType.EXTENSION_RUN_EVENT,
    userId: session.user.id,
    subjectType: "extension_run",
    subjectId: runId || campaignId || "runner-heartbeat",
    metadata: {
      eventType: "runner_heartbeat",
      campaignId: campaignId || null,
      status,
      message,
      metaJson: JSON.stringify(body?.meta ?? null),
      clientSurface: "chrome_side_panel",
    },
  });

  const runner = await getExtensionRunnerHealth(session.user.id);
  return NextResponse.json({
    ok: true,
    runner,
  });
}
