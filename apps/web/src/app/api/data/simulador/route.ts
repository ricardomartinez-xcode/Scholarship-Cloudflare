import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import {
  listD1RecentQuoteSessions,
  saveD1QuoteScenarioForUser,
} from "@/lib/cloudflare/quote-history";
import { parseQuoteHistorySavePayload } from "@/lib/quote-history-payload";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCloudflareRuntime()) {
    const { GET: getQuoteHistory } = await import("@/app/api/data/quote-history/route");
    return getQuoteHistory(request);
  }
  const auth = await getSessionUser();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (auth.status !== "ok") {
    return NextResponse.json({ error: auth.status }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 8), 1), 20);
    const sessions = await listD1RecentQuoteSessions(auth.user.id, limit);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Quote history D1 query failed", error);
    return NextResponse.json({ error: "storage_unavailable", sessions: [] }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isCloudflareRuntime()) {
    const { POST: postQuoteHistory } = await import("@/app/api/data/quote-history/route");
    return postQuoteHistory(request);
  }

  const auth = await getSessionUser();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (auth.status !== "ok") {
    return NextResponse.json({ error: auth.status }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseQuoteHistorySavePayload(payload);
  if (!parsed) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    const saved = await saveD1QuoteScenarioForUser(auth.user.id, parsed);
    return NextResponse.json(saved);
  } catch (error) {
    console.error("Quote history D1 save failed", error);
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }
}
