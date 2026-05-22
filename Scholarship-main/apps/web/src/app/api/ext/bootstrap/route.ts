import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { buildExtensionBootstrap } from "@/lib/extension-runtime";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function GET() {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const payload = await buildExtensionBootstrap({
    user: {
      id: session.user.id,
      email: session.email,
      role: session.user.role,
    },
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
