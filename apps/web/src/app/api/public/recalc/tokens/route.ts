import { AdminCapability, BusinessEventType } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { writeBusinessEventSafe } from "@/lib/business-events";
import {
  issueExtensionSessionToken,
  revokeIssuedExtensionSessionToken,
} from "@/lib/extension-session-tokens";
import {
  clampRecalcPublicApiTtlMs,
  readRecalcPublicApiBearerToken,
  RECALC_PUBLIC_API_SCOPE,
  requireRecalcPublicApiCapability,
} from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeClient(value: unknown) {
  const normalized = String(value ?? "gpt-actions").trim();
  return (normalized || "gpt-actions").slice(0, 80);
}

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("public_recalc_token_issue");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.view_admin);
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => ({}))) as {
    client?: unknown;
    ttlHours?: unknown;
  };
  const issued = await issueExtensionSessionToken({
    userId: auth.admin.id,
    scope: RECALC_PUBLIC_API_SCOPE,
    client: sanitizeClient(payload.client),
    userAgent: request.headers.get("user-agent"),
    ttlMs: clampRecalcPublicApiTtlMs(payload.ttlHours),
  });

  await writeBusinessEventSafe({
    type: BusinessEventType.EXTENSION_TOKEN_ISSUED,
    userId: auth.admin.id,
    subjectType: "public_api_token",
    subjectId: auth.admin.id,
    metadata: {
      clientSurface: "public_recalc_api",
      scope: RECALC_PUBLIC_API_SCOPE,
      tokenType: "bearer",
      expiresAt: issued.expiresAt.toISOString(),
    },
  });

  return adminApiSuccess(requestId, {
    tokenType: "Bearer",
    scope: RECALC_PUBLIC_API_SCOPE,
    token: issued.token,
    expiresAt: issued.expiresAt.toISOString(),
  });
}

export async function DELETE(request: Request) {
  const requestId = buildAdminRequestId("public_recalc_token_revoke");
  const auth = await requireRecalcPublicApiCapability(
    request,
    requestId,
    AdminCapability.view_admin,
  );
  if (!auth.ok) return auth.response;

  const token = readRecalcPublicApiBearerToken(request);
  const revoked = token ? await revokeIssuedExtensionSessionToken(token) : false;

  return adminApiSuccess(requestId, {
    revoked,
    actor: {
      id: auth.actor.id,
      email: auth.actor.email,
    },
  });
}
