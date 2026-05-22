import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { sendMetaBusinessMessagingConversion } from "@/lib/meta-conversions";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

function resolveClientIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || null;
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
        contactId?: string;
        eventName?: string;
        value?: number | string | null;
        currency?: string | null;
        eventSourceUrl?: string | null;
        sourceMessageId?: string | null;
      }
    | null;

  const contactId = String(body?.contactId ?? "").trim();
  const eventName = String(body?.eventName ?? "").trim();
  const rawValue = body?.value;
  const parsedValue =
    rawValue == null || rawValue === ""
      ? null
      : typeof rawValue === "number"
        ? rawValue
        : Number(String(rawValue).trim());

  if (!contactId) {
    return NextResponse.json({ ok: false, error: "missing_contact_id" }, { status: 400 });
  }

  if (!eventName) {
    return NextResponse.json({ ok: false, error: "missing_event_name" }, { status: 400 });
  }

  if (parsedValue != null && !Number.isFinite(parsedValue)) {
    return NextResponse.json({ ok: false, error: "invalid_value" }, { status: 400 });
  }

  try {
    const result = await sendMetaBusinessMessagingConversion({
      userId: session.user.id,
      contactId,
      eventName,
      value: parsedValue,
      currency: body?.currency ?? null,
      eventSourceUrl: body?.eventSourceUrl ?? null,
      sourceMessageId: body?.sourceMessageId ?? null,
      clientIpAddress: resolveClientIpAddress(request),
      clientUserAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "meta_conversions_send_failed",
      },
      { status: 500 },
    );
  }
}
