import { NextRequest, NextResponse } from "next/server";

import { getAdminUser } from "@/lib/admin-session";
import { updateNeonAuthOAuthProvider } from "@/lib/neon-auth-admin";

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      provider?: string;
      clientId?: string;
      clientSecret?: string;
      microsoftTenantId?: string;
    };
    const result = await updateNeonAuthOAuthProvider({
      provider: body.provider ?? "",
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      microsoftTenantId: body.microsoftTenantId,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar OAuth provider." },
      { status: 500 },
    );
  }
}
