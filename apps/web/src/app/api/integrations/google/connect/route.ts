import { NextResponse } from "next/server";

import { googleOAuthDisabledPayload } from "@/lib/google-oauth-disabled";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    googleOAuthDisabledPayload(
      "Las integraciones OAuth externas estan deshabilitadas temporalmente. Usa invitacion por correo/link y creacion de cuenta via Neon Auth.",
    ),
    { status: 503 },
  );
}

export async function POST() {
  return GET();
}
