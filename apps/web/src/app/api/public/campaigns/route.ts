import { NextResponse } from "next/server";

import {
  PublicCampaignError,
  createCampaign,
  listCampaigns,
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
    { ok: false, error: "No fue posible procesar la campaña.", code: "campaign_unexpected_error" },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const profile = await requireCampaignProfile(request);
    const limit = new URL(request.url).searchParams.get("limit");
    const campaigns = await listCampaigns(profile, limit);
    return NextResponse.json({ ok: true, campaigns }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireCampaignProfile(request);
    const body = await request.json().catch(() => null);
    const result = await createCampaign(request, profile, body);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
