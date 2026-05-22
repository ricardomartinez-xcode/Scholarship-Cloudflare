import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  deleteUserContactForUser,
  updateUserContactForUser,
} from "@/lib/user-contacts";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        contactName?: string;
        phone?: string;
        email?: string | null;
        tags?: string[] | string | null;
        personalData?: string | null;
        notes?: string | null;
        assignedQuoteSessionPublicId?: string | null;
        assignedScenarioId?: string | null;
        source?: string | null;
      }
    | null;

  try {
    const contact = await updateUserContactForUser(session.user.id, id, {
      contactName: String(body?.contactName ?? ""),
      phone: String(body?.phone ?? ""),
      email: body?.email ?? null,
      tags: body?.tags ?? [],
      personalData: body?.personalData ?? null,
      notes: body?.notes ?? null,
      assignedQuoteSessionPublicId: body?.assignedQuoteSessionPublicId ?? null,
      assignedScenarioId: body?.assignedScenarioId ?? null,
      source: body?.source ?? "manual",
    });

    return NextResponse.json({ ok: true, contact });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible actualizar el contacto.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const { id } = await context.params;

  try {
    const result = await deleteUserContactForUser(session.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible eliminar el contacto.",
      },
      { status: 400 },
    );
  }
}
