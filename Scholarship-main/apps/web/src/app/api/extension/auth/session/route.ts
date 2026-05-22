import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";

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
      {
        authenticated: false,
        status: session.status,
      },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  return NextResponse.json({
    authenticated: true,
    status: session.status,
    email: session.email,
    user: {
      id: session.user.id,
      role: session.user.role,
      isActive: session.user.isActive,
    },
  });
}
