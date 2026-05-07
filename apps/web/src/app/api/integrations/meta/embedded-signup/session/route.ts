import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { recordMetaEmbeddedSignupSession } from "@/lib/meta-embedded-signup";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
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
        clientSessionId?: string;
        status?:
          | "started"
          | "login_status"
          | "finish"
          | "cancelled"
          | "error";
        flowType?: "embedded_signup" | "whatsapp_api";
        appId?: string;
        configId?: string;
        sessionInfoVersion?: number;
        facebookUserId?: string;
        facebookLoginStatus?: string;
        wabaId?: string;
        phoneNumberId?: string;
        businessAccountId?: string;
        errorMessage?: string;
        payload?: unknown;
      }
    | null;

  const clientSessionId = String(body?.clientSessionId ?? "").trim();
  if (!clientSessionId) {
    return NextResponse.json({ ok: false, error: "missing_client_session_id" }, { status: 400 });
  }

  const status = String(body?.status ?? "").trim();
  if (!status) {
    return NextResponse.json({ ok: false, error: "missing_status" }, { status: 400 });
  }

  try {
    const record = await recordMetaEmbeddedSignupSession({
      userId: session.user.id,
      clientSessionId,
      status: body?.status ?? "started",
      flowType: body?.flowType,
      appId: body?.appId ?? process.env.META_APP_ID?.trim() ?? null,
      configId: body?.configId ?? null,
      sessionInfoVersion:
        typeof body?.sessionInfoVersion === "number" ? body.sessionInfoVersion : null,
      graphApiVersion: process.env.META_GRAPH_API_VERSION?.trim() ?? "v25.0",
      facebookUserId: body?.facebookUserId ?? null,
      facebookLoginStatus: body?.facebookLoginStatus ?? null,
      wabaId: body?.wabaId ?? null,
      phoneNumberId: body?.phoneNumberId ?? null,
      businessAccountId: body?.businessAccountId ?? null,
      errorMessage: body?.errorMessage ?? null,
      payload: body?.payload,
    });

    return NextResponse.json({ ok: true, recordId: record.id });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "embedded_signup_session_failed",
      },
      { status: 500 },
    );
  }
}
