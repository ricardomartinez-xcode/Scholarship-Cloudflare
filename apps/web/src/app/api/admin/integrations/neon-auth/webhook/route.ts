import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      code: "neon_auth_webhook_admin_temporarily_disabled",
      message:
        "La configuracion administrativa de webhooks Neon Auth esta deshabilitada temporalmente. El webhook publico conserva solo el flujo legado necesario.",
    },
    { status: 503 },
  );
}

export async function GET() {
  return POST();
}
