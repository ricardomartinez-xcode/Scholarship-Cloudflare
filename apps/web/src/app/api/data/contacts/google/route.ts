import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { listGoogleContactsPreview } from "@/lib/google-integration";
import { importUserContactsForUser } from "@/lib/user-contacts";

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
    const contacts = await listGoogleContactsPreview({
      userId: session.user.id,
      query: url.searchParams.get("q"),
    });

    return NextResponse.json({
      ok: true,
      contacts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible cargar los contactos de Google.",
      },
      { status: 400 },
    );
  }
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
        contacts?: Array<{
          displayName?: string;
          primaryPhone?: string | null;
          primaryEmail?: string | null;
          organization?: string | null;
          title?: string | null;
        }>;
      }
    | null;

  const rows = (body?.contacts ?? [])
    .map((contact) => ({
      contactName: String(contact.displayName ?? "").trim() || null,
      phone: String(contact.primaryPhone ?? "").trim(),
      email: String(contact.primaryEmail ?? "").trim() || null,
      personalData: [contact.organization, contact.title]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(" · ") || null,
      source: "google_contacts",
    }))
    .filter((contact) => contact.phone);

  if (!rows.length) {
    return NextResponse.json(
      {
        ok: false,
        error: "Debes seleccionar al menos un contacto de Google con teléfono.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await importUserContactsForUser(
      session.user.id,
      rows,
      "google_contacts",
    );

    return NextResponse.json({
      ok: true,
      importedCount: result.importedCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible importar los contactos de Google.",
      },
      { status: 400 },
    );
  }
}
