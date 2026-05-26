import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  parseGoogleCallbackState,
  upsertGoogleConnectionFromCode,
} from "@/lib/google-integration";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const parsedState = state
    ? parseGoogleCallbackState(state)
    : { userId: "", nextPath: "/profile", intent: "manual", service: "all" };
  const nextPath = parsedState.nextPath;

  if (!code) {
    return NextResponse.redirect(
      new URL(`/profile?googleSync=error`, url.origin),
    );
  }

  const session = await getSessionUser();
  let userId = "";
  if (session.status === "ok") {
    if (parsedState.userId && parsedState.userId !== session.user.id) {
      return NextResponse.redirect(
        new URL(`/profile?googleSync=state-mismatch`, url.origin),
      );
    }
    userId = session.user.id;
  } else if (
    session.status === "unauthenticated" &&
    parsedState.userId &&
    "signed" in parsedState &&
    parsedState.signed &&
    parsedState.validSignature &&
    !parsedState.expired
  ) {
    userId = parsedState.userId;
  } else {
    return NextResponse.redirect(
      new URL(
        `${nextPath}?googleSync=session-expired&googleSyncIntent=${encodeURIComponent(parsedState.intent)}`,
        url.origin,
      ),
    );
  }

  try {
    await upsertGoogleConnectionFromCode({
      userId,
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
