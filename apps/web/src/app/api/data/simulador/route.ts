import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import { listD1RecentQuoteSessions } from "@/lib/cloudflare/quote-history";
import {
  GET as getQuoteHistory,
  POST as postQuoteHistory,
} from "@/app/api/data/quote-history/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCloudflareRuntime()) {
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
  return postQuoteHistory(request);
}
