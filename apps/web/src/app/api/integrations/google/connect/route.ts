import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      code: "oauth_integrations_temporarily_disabled",
      message:
        "Las integraciones OAuth externas estan deshabilitadas temporalmente. Usa invitacion por correo/link y creacion de cuenta via Neon Auth.",
    },
    { status: 503 },
  );
}

export async function POST() {
  return GET();
}
