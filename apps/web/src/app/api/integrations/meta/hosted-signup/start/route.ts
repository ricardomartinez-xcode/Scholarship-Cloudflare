import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { recordMetaEmbeddedSignupSession } from "@/lib/meta-embedded-signup";
import { buildMetaHostedSignupUrl, createMetaHostedSignupState } from "@/lib/meta-hosted-signup";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.redirect(new URL("/admin/auth", process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000"));
  }

  const clientSessionId = randomUUID();
  try {
    const state = createMetaHostedSignupState({ userId: session.user.id, clientSessionId });
    const url = buildMetaHostedSignupUrl(state);
    await recordMetaEmbeddedSignupSession({
      userId: session.user.id,
      clientSessionId,
      status: "started",
      flowType: "embedded_signup",
      appId: process.env.META_APP_ID?.trim() ?? null,
      configId: process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID?.trim() ?? null,
      sessionInfoVersion: 3,
      graphApiVersion: process.env.META_GRAPH_API_VERSION?.trim() ?? "v25.0",
      payload: { mode: "hosted", redirectUri: process.env.META_OAUTH_REDIRECT_URI?.trim() ?? null },
    });
    return NextResponse.redirect(url);
  } catch (error) {
    await recordMetaEmbeddedSignupSession({
      userId: session.user.id,
      clientSessionId,
      status: "error",
      flowType: "embedded_signup",
      errorMessage: error instanceof Error ? error.message : "hosted_signup_start_failed",
    }).catch(() => null);
    const destination = new URL("/admin/meta/embedded-signup", process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000");
    destination.searchParams.set("meta_status", "error");
    destination.searchParams.set("meta_error", "hosted_signup_start_failed");
    return NextResponse.redirect(destination);
  }
}
