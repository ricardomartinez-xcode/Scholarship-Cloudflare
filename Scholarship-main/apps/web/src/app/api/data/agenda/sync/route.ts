import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { syncAgendaToGoogle } from "@/lib/google-integration";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function POST() {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  try {
    const result = await syncAgendaToGoogle(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo sincronizar la agenda con Google.",
      },
      { status: 400 },
    );
  }
}
