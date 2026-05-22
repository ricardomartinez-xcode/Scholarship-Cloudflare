import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  getUserContactsBootstrap,
  importUserContactsForUser,
  parseUserContactsCsv,
  parseUserContactsText,
  upsertUserContactForUser,
} from "@/lib/user-contacts";

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

  const payload = await getUserContactsBootstrap(session.user.id);
  return NextResponse.json({
    ok: true,
    ...payload,
  });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: session.status },
      { status: statusCodeForSessionState(session.status) },
    );
  }

  const body = (await request.json().catch(() => null)) as
      | {
          contactsText?: string | null;
          contactsCsvText?: string | null;
          contact?: {
            contactName?: string;
            phone?: string;
          email?: string | null;
          tags?: string[] | string | null;
          personalData?: string | null;
          notes?: string | null;
          assignedQuoteSessionPublicId?: string | null;
          assignedScenarioId?: string | null;
          source?: string | null;
        } | null;
      }
    | null;

  try {
    if (String(body?.contactsCsvText ?? "").trim()) {
      const result = await importUserContactsForUser(
        session.user.id,
        parseUserContactsCsv(String(body?.contactsCsvText ?? "")),
        "extension_csv_import",
      );
      return NextResponse.json(result, { status: 201 });
    }

    if (String(body?.contactsText ?? "").trim()) {
      const result = await importUserContactsForUser(
        session.user.id,
        parseUserContactsText(String(body?.contactsText ?? "")),
        "extension_import",
      );
      return NextResponse.json(result, { status: 201 });
    }

    if (!body?.contact) {
      return NextResponse.json(
        { ok: false, error: "Debes enviar un contacto o un bloque de importación." },
        { status: 400 },
      );
    }

    const contact = await upsertUserContactForUser(session.user.id, {
      contactName: String(body.contact.contactName ?? ""),
      phone: String(body.contact.phone ?? ""),
      email: body.contact.email ?? null,
      tags: body.contact.tags ?? [],
      personalData: body.contact.personalData ?? null,
      notes: body.contact.notes ?? null,
      assignedQuoteSessionPublicId: body.contact.assignedQuoteSessionPublicId ?? null,
      assignedScenarioId: body.contact.assignedScenarioId ?? null,
      source: body.contact.source ?? "extension_manual",
    });

    return NextResponse.json({ ok: true, contact }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible guardar el contacto.",
      },
      { status: 400 },
    );
  }
}
