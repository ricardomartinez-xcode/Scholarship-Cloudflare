import { NextResponse } from "next/server";

import {
  PublicCampaignError,
  createCampagn,
  requireCampaignProfile,
} from "@/lib/public-campaign-sender";

export const dynamic = "force-dynamic";

const UNKNOWN_SENDER = "recalc_sender_unavailable";

function errorResponse(error: unknown) {
  if (error instanceof PublicCampaignError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: "No fue posible procesar la campaña.",
      code: "campaign_unexpected_error",
    },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const profile = await requireCampaignProfile(request);
    const body = await request.json().catch(() => null);

    // WhatsApp Web no expone el número de la cuenta de forma estable.
    // Para no bloquear la campaña, se conserva el perfil autenticado y se usa un marcador interno.
    const profileWithOptionalSender = {
      ...profile,
      senderPhone: profile.senderPhone || UNKNOWN_SENDER,
    };

    const result = await createCampaign(request, profileWithOptionalSender, body);
    return NextResponse.json( { ok: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
