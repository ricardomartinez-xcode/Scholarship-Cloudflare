import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { forceSyncUserContactsForUser } from "@/lib/user-contacts";

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
    const result = await forceSyncUserContactsForUser(session.user.id);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo sincronizar contactos con Google Sheets.",
      },
      { status: 400 },
    );
  }
}
