import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { getAgendaGooglePreview } from "@/lib/google-integration";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  try {
    const url = new URL(request.url);
    const preview = await getAgendaGooglePreview({
      userId: session.user.id,
      calendarId: url.searchParams.get("calendarId"),
      tasklistId: url.searchParams.get("tasklistId"),
      month: url.searchParams.get("month"),
    });

    return NextResponse.json({
      ok: true,
      ...preview,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible cargar la vista previa de Google.",
      },
      { status: 400 },
    );
  }
}
