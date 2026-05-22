import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  disconnectGoogleIntegration,
  getAgendaIntegrationStatus,
  updateAgendaSyncPreference,
} from "@/lib/google-integration";

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

  const status = await getAgendaIntegrationStatus(session.user.id);
  return NextResponse.json({
    ok: true,
    ...status,
  });
}

export async function PATCH(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        syncCalendarEnabled?: boolean;
        syncTasksEnabled?: boolean;
        syncSheetsEnabled?: boolean;
        calendarId?: string | null;
        tasklistId?: string | null;
        spreadsheetId?: string | null;
        worksheetName?: string | null;
      }
    | null;

  const preference = await updateAgendaSyncPreference({
    userId: session.user.id,
    syncCalendarEnabled: body?.syncCalendarEnabled,
    syncTasksEnabled: body?.syncTasksEnabled,
    syncSheetsEnabled: body?.syncSheetsEnabled,
    calendarId: body?.calendarId,
    tasklistId: body?.tasklistId,
    spreadsheetId: body?.spreadsheetId,
    worksheetName: body?.worksheetName,
  });

  return NextResponse.json({
    ok: true,
    preference,
  });
}

export async function DELETE() {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const result = await disconnectGoogleIntegration(session.user.id);
  return NextResponse.json({
    ok: true,
    ...result,
  });
}
