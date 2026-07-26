import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { recordMetaEmbeddedSignupSession } from "@/lib/meta-embedded-signup";
import { connectMetaHostedSignup } from "@/lib/meta-hosted-connection";
import { getMetaHostedSignupRedirectUri, verifyMetaHostedSignupState } from "@/lib/meta-hosted-signup";

export const dynamic = "force-dynamic";

function destination(status: "success" | "cancelled" | "error", detail?: string) {
  const url = new URL("/admin/meta/embedded-signup", process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000");
  url.searchParams.set("meta_status", status);
  if (detail) url.searchParams.set("meta_error", detail.slice(0, 120));
  return url;
}

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") return NextResponse.redirect(destination("error", "session_expired"));

  const query = new URL(request.url).searchParams;
  const code = query.get("code")?.trim() ?? "";
  const stateValue = query.get("state")?.trim() ?? "";
  const metaError = query.get("error")?.trim() || query.get("error_reason")?.trim();

  let state: ReturnType<typeof verifyMetaHostedSignupState>;
  try {
    state = verifyMetaHostedSignupState(stateValue);
    if (state.userId !== session.user.id) throw new Error("meta_oauth_user_mismatch");
  } catch (error) {
    return NextResponse.redirect(destination("error", error instanceof Error ? error.message : "invalid_meta_oauth_state"));
  }

  if (metaError || !code) {
    await recordMetaEmbeddedSignupSession({
      userId: session.user.id,
      clientSessionId: state.clientSessionId,
      status: metaError ? "error" : "cancelled",
      flowType: "embedded_signup",
      errorMessage: metaError ?? "missing_authorization_code",
      payload: Object.fromEntries(query.entries()),
    }).catch(() => null);
    return NextResponse.redirect(destination(metaError ? "error" : "cancelled", metaError ?? undefined));
  }

  try {
    await recordMetaEmbeddedSignupSession({
      userId: session.user.id,
      clientSessionId: state.clientSessionId,
      status: "code_received",
      flowType: "embedded_signup",
      authorizationCode: code,
      payload: { mode: "hosted", callbackReceived: true },
    });
    await connectMetaHostedSignup({
      userId: session.user.id,
      code,
      redirectUri: getMetaHostedSignupRedirectUri(),
    });
    await recordMetaEmbeddedSignupSession({
      userId: session.user.id,
      clientSessionId: state.clientSessionId,
      status: "exchanged",
      flowType: "embedded_signup",
    });
    return NextResponse.redirect(destination("success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "meta_code_exchange_failed";
    await recordMetaEmbeddedSignupSession({
      userId: session.user.id,
      clientSessionId: state.clientSessionId,
      status: "exchange_failed",
      flowType: "embedded_signup",
      errorMessage: message,
    }).catch(() => null);
    return NextResponse.redirect(destination("error", "meta_code_exchange_failed"));
  }
}
