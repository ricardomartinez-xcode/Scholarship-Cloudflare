import { NextResponse } from "next/server";

import { googleOAuthDisabledPayload } from "@/lib/google-oauth-disabled";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    googleOAuthDisabledPayload(
      "El callback OAuth externo esta deshabilitado temporalmente. El acceso administrativo queda por invitacion y Neon Auth.",
    ),
    { status: 503 },
  );
}

export async function POST() {
  return GET();
}
