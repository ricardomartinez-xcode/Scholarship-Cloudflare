import { NextResponse } from "next/server";

import {
  PublicCampaignError,
  getCampaignDetail,
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
    { ok: false, error: "No fue posible cargar la campaña.", code: "campaign_unexpected_error" },
    { status: 500 },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  try {
    const profile = await requireCampaignProfile(request);
    const { campaignId } = await context.params;
    const detail = await getCampaignDetail(profile, campaignId);
    return NextResponse.json({ ok: true, ...detail }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
