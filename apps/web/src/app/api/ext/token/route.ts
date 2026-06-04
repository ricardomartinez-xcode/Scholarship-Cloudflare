import { BusinessEventType } from "@prisma/client";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { writeBusinessEventSafe } from "@/lib/business-events";
import { issueExtensionSessionToken } from "@/lib/extension-session-tokens";

export const dynamic = "force-dynamic";

type ApiTokenRequestPayload = {
  ttlMs?: number | string | null;
  duration?: string | null;
  ttlPreset?: string | null;
  sessionDuration?: string | null;
  tokenDuration?: string | null;
  apiTokenDuration?: string | null;
};

async function readApiTokenRequestPayload(request: Request): Promise<ApiTokenRequestPayload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return {};

  try {
    return (await request.json()) as ApiTokenRequestPayload;
  } catch {
    return {};
  }
}

function readRequestedApiTokenDuration(payload: ApiTokenRequestPayload) {
  const rawTtlMs = payload.ttlMs;
  const ttlMs =
    typeof rawTtlMs === "number"
      ? rawTtlMs
      : typeof rawTtlMs === "string"
        ? Number(rawTtlMs)
        : null;

  const ttlPreset =
    [
      payload.apiTokenDuration,
      payload.tokenDuration,
      payload.sessionDuration,
      payload.duration,
      payload.ttlPreset,
    ]
      .map((value) => String(value ?? "").trim())
      .find(Boolean) ?? null;

  return { ttlMs, ttlPreset };
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json({ error: "web_session_invalid" }, { status: 401 });
  }

  const payload = await readApiTokenRequestPayload(request);
  const requestedDuration = readRequestedApiTokenDuration(payload);

  const issuedToken = await issueExtensionSessionToken({
    userId: session.user.id,
    client: request.headers.get("x-extension-client") ?? "web_session_handoff",
    extensionVersion: request.headers.get("x-extension-version"),
    userAgent: request.headers.get("user-agent"),
    scope: "extension:chrome-sidepanel",
    ttlMs: requestedDuration.ttlMs,
    ttlPreset: requestedDuration.ttlPreset,
  });

  await writeBusinessEventSafe({
    type: BusinessEventType.EXTENSION_TOKEN_ISSUED,
    userId: session.user.id,
    subjectType: "extension_token",
    subjectId: session.user.id,
    metadata: {
      clientSurface: "web_session_handoff",
      extensionTokenType: "issued",
      role: session.user.role,
      email: session.email,
      expiresAt: issuedToken.expiresAt.toISOString(),
      tokenDuration: issuedToken.ttlPreset,
      tokenTtlMs: issuedToken.ttlMs,
    },
  });

  return NextResponse.json({
    ok: true,
    token: issuedToken.token,
    expiresAt: issuedToken.expiresAt.toISOString(),
    tokenDuration: issuedToken.ttlPreset,
    tokenTtlMs: issuedToken.ttlMs,
    user: {
      id: session.user.id,
      email: session.email,
      role: session.user.role,
    },
  });
}
