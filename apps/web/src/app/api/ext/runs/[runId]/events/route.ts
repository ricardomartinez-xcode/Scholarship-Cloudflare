import { BusinessEventType } from "@prisma/client";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { writeBusinessEventSafe } from "@/lib/business-events";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const limiter = await checkRateLimit(`ext-run-events:${session.user.id}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterMs: limiter.retryAfterMs },
      { status: 429 },
    );
  }

  const { runId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        eventType?: string;
        message?: string;
        metaJson?: unknown;
      }
    | null;
  const eventType = String(body?.eventType ?? "").trim() || "info";
  const message = String(body?.message ?? "").trim() || null;

  await writeBusinessEventSafe({
    type: BusinessEventType.EXTENSION_RUN_EVENT,
    userId: session.user.id,
    subjectType: "extension_run",
    subjectId: runId,
    metadata: {
      eventType,
      message,
      metaJson: body?.metaJson ?? null,
      clientSurface: request.headers.get("x-extension-client") ?? "chrome_side_panel",
      extensionVersion: request.headers.get("x-extension-version") ?? null,
    },
  });

  if (
    eventType === "whatsapp_opened" ||
    eventType === "whatsapp_draft_applied"
  ) {
    await writeBusinessEventSafe({
      type: BusinessEventType.WHATSAPP_WEB_OPENED,
      userId: session.user.id,
      subjectType: "extension_run",
      subjectId: runId,
      metadata: {
        eventType,
        message,
        metaJson: body?.metaJson ?? null,
        clientSurface: request.headers.get("x-extension-client") ?? "chrome_side_panel",
      extensionVersion: request.headers.get("x-extension-version") ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true, runId });
}
