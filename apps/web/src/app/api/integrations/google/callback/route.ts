import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      code: "oauth_integrations_temporarily_disabled",
      message:
        "El callback OAuth externo esta deshabilitado temporalmente. El acceso administrativo queda por invitacion y Neon Auth.",
    },
    { status: 503 },
  );
}

export async function POST() {
  return GET();
}
