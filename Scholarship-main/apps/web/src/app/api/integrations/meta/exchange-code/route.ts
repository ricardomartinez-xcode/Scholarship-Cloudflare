import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { recordMetaEmbeddedSignupSession } from "@/lib/meta-embedded-signup";
import { upsertMetaWhatsappConnectionFromCode } from "@/lib/meta-whatsapp";

export const dynamic = "force-dynamic";

function statusCodeForSessionState(status: "unauthenticated" | "forbidden" | "inactive" | "ok") {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json({ ok: false, error: session.status }, { status: statusCodeForSessionState(session.status) });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        code?: string;
        clientSessionId?: string;
        flowType?: "embedded_signup" | "whatsapp_api";
        facebookUserId?: string;
        facebookLoginStatus?: string;
        configId?: string;
        sessionInfoVersion?: number;
        wabaId?: string;
        phoneNumberId?: string;
        businessAccountId?: string;
      }
    | null;

  const code = String(body?.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ ok: false, error: "missing_code" }, { status: 400 });
  }

  try {
    if (body?.clientSessionId) {
      await recordMetaEmbeddedSignupSession({
        userId: session.user.id,
        clientSessionId: String(body.clientSessionId),
        status: "code_received",
        flowType: body.flowType,
        appId: process.env.META_APP_ID?.trim() ?? null,
        configId: body.configId ?? null,
        sessionInfoVersion:
          typeof body.sessionInfoVersion === "number" ? body.sessionInfoVersion : null,
        graphApiVersion: process.env.META_GRAPH_API_VERSION?.trim() ?? "v25.0",
        facebookUserId: body.facebookUserId ?? null,
        facebookLoginStatus: body.facebookLoginStatus ?? null,
        authorizationCode: code,
        wabaId: body?.wabaId ?? null,
        phoneNumberId: body?.phoneNumberId ?? null,
        businessAccountId: body?.businessAccountId ?? null,
        payload: {
          source: "exchange_code_route",
          step: "code_received",
        },
      });
    }

    const connection = await upsertMetaWhatsappConnectionFromCode({
      userId: session.user.id,
      code,
      wabaId: body?.wabaId,
      phoneNumberId: body?.phoneNumberId,
      businessAccountId: body?.businessAccountId,
    });

    if (body?.clientSessionId) {
      await recordMetaEmbeddedSignupSession({
        userId: session.user.id,
        clientSessionId: String(body.clientSessionId),
        status: "exchanged",
        flowType: body.flowType,
        appId: process.env.META_APP_ID?.trim() ?? null,
        configId: body.configId ?? null,
        sessionInfoVersion:
          typeof body.sessionInfoVersion === "number" ? body.sessionInfoVersion : null,
        graphApiVersion: connection?.graphApiVersion ?? process.env.META_GRAPH_API_VERSION?.trim() ?? "v25.0",
        facebookUserId: body.facebookUserId ?? null,
        facebookLoginStatus: body.facebookLoginStatus ?? null,
        wabaId: body?.wabaId ?? connection?.wabaId ?? null,
        phoneNumberId: body?.phoneNumberId ?? connection?.phoneNumberId ?? null,
        businessAccountId: body?.businessAccountId ?? connection?.businessAccountId ?? null,
        payload: {
          source: "exchange_code_route",
          step: "exchange_success",
        },
      });
    }

    return NextResponse.json({ ok: true, connection });
  } catch (error) {
    if (body?.clientSessionId) {
      await recordMetaEmbeddedSignupSession({
        userId: session.user.id,
        clientSessionId: String(body.clientSessionId),
        status: "exchange_failed",
        flowType: body.flowType,
        appId: process.env.META_APP_ID?.trim() ?? null,
        configId: body.configId ?? null,
        sessionInfoVersion:
          typeof body.sessionInfoVersion === "number" ? body.sessionInfoVersion : null,
        graphApiVersion: process.env.META_GRAPH_API_VERSION?.trim() ?? "v25.0",
        facebookUserId: body.facebookUserId ?? null,
        facebookLoginStatus: body.facebookLoginStatus ?? null,
        wabaId: body?.wabaId ?? null,
        phoneNumberId: body?.phoneNumberId ?? null,
        businessAccountId: body?.businessAccountId ?? null,
        errorMessage: error instanceof Error ? error.message : "meta_exchange_failed",
        payload: {
          source: "exchange_code_route",
          step: "exchange_failed",
        },
      }).catch(() => null);
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "meta_exchange_failed",
      },
      { status: 500 },
    );
  }
}
