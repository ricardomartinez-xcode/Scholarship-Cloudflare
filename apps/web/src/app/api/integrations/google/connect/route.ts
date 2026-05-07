import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  type GoogleConnectIntent,
  type GoogleConnectService,
  buildGoogleConnectUrl,
} from "@/lib/google-integration";

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

  const url = new URL(request.url);
  const nextPath = url.searchParams.get("next");
  const serviceCandidate = String(url.searchParams.get("service") ?? "")
    .trim()
    .toLowerCase();
  const intentCandidate = String(url.searchParams.get("intent") ?? "")
    .trim()
    .toLowerCase();
  const service: GoogleConnectService =
    serviceCandidate === "agenda" ||
    serviceCandidate === "contacts" ||
    serviceCandidate === "calendar" ||
    serviceCandidate === "tasks" ||
    serviceCandidate === "sheets" ||
    serviceCandidate === "all"
      ? (serviceCandidate as GoogleConnectService)
      : "all";
  const intent: GoogleConnectIntent =
    intentCandidate === "agenda_sync" ||
    intentCandidate === "contacts_sync" ||
    intentCandidate === "manual"
      ? (intentCandidate as GoogleConnectIntent)
      : "manual";
  const redirectUrl = buildGoogleConnectUrl({
    userId: session.user.id,
    nextPath,
    service,
    intent,
    loginHint: session.user.email ?? null,
  });

  return NextResponse.redirect(redirectUrl);
}
