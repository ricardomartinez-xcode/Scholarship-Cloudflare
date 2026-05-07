import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { writeQuoteHistoryEvent } from "@/lib/quote-history";
import { type QuoteHistoryEventPayload } from "@/lib/quote-history-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorizedResponse(status: "unauthenticated" | "forbidden" | "inactive") {
  return NextResponse.json({ error: status }, { status: status === "unauthenticated" ? 401 : 403 });
}

function parseEventPayload(payload: unknown): QuoteHistoryEventPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;
  const type =
    raw.type === "CTA_CLICKED" ||
    raw.type === "QUOTE_SCENARIO_LOADED" ||
    raw.type === "QUOTE_COMPARISON_VIEWED"
      ? raw.type
      : null;
  if (!type) return null;

  const metadata =
    raw.metadata && typeof raw.metadata === "object"
      ? (raw.metadata as Record<string, unknown>)
      : null;

  return {
    type,
    sessionPublicId: String(raw.sessionPublicId ?? "").trim() || null,
    scenarioId: String(raw.scenarioId ?? "").trim() || null,
    metadata,
  };
}

export async function POST(request: Request) {
  const auth = await getSessionUser();
  if (auth.status !== "ok") {
    return unauthorizedResponse(auth.status);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseEventPayload(payload);
  if (!parsed) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  await writeQuoteHistoryEvent({
    ownerUserId: auth.user.id,
    payload: parsed,
  });

  return NextResponse.json({ ok: true });
}
