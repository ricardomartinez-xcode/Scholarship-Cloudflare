import { NextResponse } from "next/server";

import { campaignHealth, PublicCampaignError } from "@/lib/public-campaign-sender";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await campaignHealth();
    return NextResponse.json(
      { ok: true, ...health },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PublicCampaignError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: "No fue posible comprobar Campaign Sender.", code: "campaign_health_failed" },
      { status: 503 },
    );
  }
}
