import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { recordExtensionCampaignDispatch } from "@/lib/extension-automation";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const { campaignId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        results?: Array<{
          recipientId?: string;
          status?: "sent" | "failed" | "queued";
          error?: string | null;
        }>;
      }
    | null;

  const campaign = await recordExtensionCampaignDispatch({
    userId: session.user.id,
    campaignId,
    results:
      body?.results?.map((result) => ({
        recipientId: String(result.recipientId ?? ""),
        status: result.status ?? "queued",
        error: result.error ?? null,
      })) ?? [],
  });

  return NextResponse.json({
    ok: true,
    campaign,
  });
}
