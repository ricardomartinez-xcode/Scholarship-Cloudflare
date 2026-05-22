import { BusinessEventType } from "@prisma/client";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { writeBusinessEventSafe } from "@/lib/business-events";
import { issueExtensionSessionToken } from "@/lib/extension-session-tokens";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (session.status !== "ok") {
    return NextResponse.json({ error: "web_session_invalid" }, { status: 401 });
  }

  const issuedToken = await issueExtensionSessionToken({
    userId: session.user.id,
    client: request.headers.get("x-extension-client") ?? "web_session_handoff",
    extensionVersion: request.headers.get("x-extension-version"),
    userAgent: request.headers.get("user-agent"),
    scope: "extension:chrome-sidepanel",
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
    },
  });

  return NextResponse.json({
    ok: true,
    token: issuedToken.token,
    expiresAt: issuedToken.expiresAt.toISOString(),
    user: {
      id: session.user.id,
      email: session.email,
      role: session.user.role,
    },
  });
}
