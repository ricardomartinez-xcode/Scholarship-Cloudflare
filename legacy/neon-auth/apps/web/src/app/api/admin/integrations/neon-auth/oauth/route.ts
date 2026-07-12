import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      code: "neon_auth_oauth_admin_temporarily_disabled",
      message:
        "La configuracion administrativa de OAuth provider esta deshabilitada temporalmente. El flujo activo es invitacion por correo/link + cuenta Neon Auth.",
    },
    { status: 503 },
  );
}

export async function GET() {
  return POST();
}
