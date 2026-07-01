import { NextResponse } from "next/server";

import {
  PublicCampaignError,
  recordCampaignEvent,
  requireCampaignProfile,
} from "@/lib/public-campaign-sender";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof PublicCampaignError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { ok: false, error: "No fue posible registrar el resultado.", code: "campaign_unexpected_error" },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  try {
    const profile = await requireCampaignProfile(request);
    const { campaignId } = await context.params;
    const body = await request.json().catch(() => null);
    const campaign = await recordCampaignEvent(request, profile, campaignId, body);
    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    return errorResponse(error);
  }
}
