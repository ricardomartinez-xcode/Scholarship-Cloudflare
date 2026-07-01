import { NextResponse } from "next/server";

import {
  PublicCampaignError,
  createCampaignProfile,
  requireCampaignProfile,
  updateCampaignProfile,
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
    { ok: false, error: "No fue posible actualizar el perfil local.", code: "profile_unexpected_error" },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const result = await createCampaignProfile(request, body);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const profile = await requireCampaignProfile(request);
    const body = await request.json().catch(() => null);
    const updated = await updateCampaignProfile(profile, body);
    return NextResponse.json({ ok: true, profile: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
