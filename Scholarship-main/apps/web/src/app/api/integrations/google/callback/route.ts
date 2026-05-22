import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  parseGoogleState,
  upsertGoogleConnectionFromCode,
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
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const parsedState = state
    ? parseGoogleState(state)
    : { userId: "", nextPath: "/profile", intent: "manual", service: "all" };
  const nextPath = parsedState.nextPath;

  if (!code) {
    return NextResponse.redirect(
      new URL(`/profile?googleSync=error`, url.origin),
    );
  }

  if (parsedState.userId && parsedState.userId !== session.user.id) {
    return NextResponse.redirect(
      new URL(`/profile?googleSync=state-mismatch`, url.origin),
    );
  }

  try {
    await upsertGoogleConnectionFromCode({
      userId: session.user.id,
      code,
    });
  } catch {
    return NextResponse.redirect(
      new URL(
        `${nextPath}?googleSync=sync-error&googleSyncIntent=${encodeURIComponent(parsedState.intent)}`,
        url.origin,
      ),
    );
  }

  return NextResponse.redirect(
    new URL(
      `${nextPath}?googleSync=connected&googleSyncIntent=${encodeURIComponent(parsedState.intent)}`,
      url.origin,
    ),
  );
}
