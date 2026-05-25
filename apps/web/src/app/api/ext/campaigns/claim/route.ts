import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { claimExtensionCampaignBatch } from "@/lib/extension-automation";
import { checkRateLimit } from "@/lib/rate-limit";

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

  const limiter = await checkRateLimit(`ext-campaign-claim:${session.user.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterMs: limiter.retryAfterMs },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        campaignId?: string | null;
      }
    | null;

  const result = await claimExtensionCampaignBatch({
    userId: session.user.id,
    campaignId: body?.campaignId ?? null,
  });

  return NextResponse.json({
    ok: true,
    batch: result,
  });
}
