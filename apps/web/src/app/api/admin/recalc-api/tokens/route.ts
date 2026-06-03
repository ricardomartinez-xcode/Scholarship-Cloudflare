import { AdminAuditAction, AdminCapability, AdminConfigModule, BusinessEventType } from "@prisma/client";
import { z } from "zod";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { writeBusinessEventSafe } from "@/lib/business-events";
import {
  issueExtensionSessionToken,
  listIssuedExtensionSessions,
} from "@/lib/extension-session-tokens";
import { getPublicBaseUrl } from "@/lib/public-base-url";
import {
  clampRecalcPublicApiTtlMs,
  RECALC_PUBLIC_API_SCOPE,
} from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tokenRequestSchema = z.object({
  client: z.string().trim().min(1).max(80).default("gpt-actions"),
  ttlHours: z.coerce.number().min(0.083).max(24).default(24),
});

function publicOrigin(request: Request) {
  const configured = getPublicBaseUrl();
  if (configured) return configured;
  return new URL(request.url).origin.replace(/\/+$/, "");
}

function serializeTokenRow(row: Awaited<ReturnType<typeof listIssuedExtensionSessions>>[number]) {
  const now = Date.now();
  const expired = row.expiresAt.getTime() <= now;
  const revoked = Boolean(row.revokedAt);

  return {
    id: row.id,
    scope: row.scope,
    client: row.client,
    extensionVersion: row.extensionVersion,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    status: revoked ? "revoked" : expired ? "expired" : "active",
  };
}

async function buildTokenPayload(request: Request, userId: string) {
  const origin = publicOrigin(request);
  const tokens = await listIssuedExtensionSessions({
    userId,
    scope: RECALC_PUBLIC_API_SCOPE,
    includeRevoked: true,
    take: 50,
  });

  return {
    integration: {
      scope: RECALC_PUBLIC_API_SCOPE,
      tokenType: "Bearer",
      authHeader: "Authorization: Bearer <token>",
      openApiUrl: `${origin}/api/public/recalc/openapi.json`,
      serverUrl: origin,
      maxTtlHours: 24,
      clients: ["gpt-actions", "intranet-api"],
      actionsReady: true,
    },
    tokens: tokens.map(serializeTokenRow),
  };
}

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("admin_recalc_api_tokens");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.view_admin_operations);
  if (!auth.ok) return auth.response;

  try {
    return adminApiSuccess(requestId, await buildTokenPayload(request, auth.admin.id));
  } catch {
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "RECALC_API_TOKENS_LIST_FAILED",
      error: "No fue posible cargar los tokens de API.",
      recoverable: true,
    });
  }
}

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_recalc_api_token_issue");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.view_admin_operations);
  if (!auth.ok) return auth.response;

  const parsed = tokenRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_RECALC_API_TOKEN_PAYLOAD",
      error: "Payload inválido para crear token de API.",
      details: parsed.error.flatten(),
      recoverable: true,
    });
  }

  try {
    const issued = await issueExtensionSessionToken({
      userId: auth.admin.id,
      scope: RECALC_PUBLIC_API_SCOPE,
      client: parsed.data.client,
      userAgent: request.headers.get("user-agent"),
      ttlMs: clampRecalcPublicApiTtlMs(parsed.data.ttlHours),
    });

    await writeBusinessEventSafe({
      type: BusinessEventType.EXTENSION_TOKEN_ISSUED,
      userId: auth.admin.id,
      subjectType: "public_api_token",
      subjectId: auth.admin.id,
      metadata: {
        clientSurface: parsed.data.client,
        scope: RECALC_PUBLIC_API_SCOPE,
        tokenType: "bearer",
        expiresAt: issued.expiresAt.toISOString(),
      },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.CREATE,
      actor: auth.admin,
      entityType: "PublicApiToken",
      entityId: auth.admin.id,
      requestId,
      after: {
        client: parsed.data.client,
        scope: RECALC_PUBLIC_API_SCOPE,
        expiresAt: issued.expiresAt.toISOString(),
      },
      message: `Token API Recalc emitido para ${parsed.data.client}.`,
    });

    return adminApiSuccess(
      requestId,
      {
        tokenType: "Bearer",
        scope: RECALC_PUBLIC_API_SCOPE,
        token: issued.token,
        expiresAt: issued.expiresAt.toISOString(),
        ...(await buildTokenPayload(request, auth.admin.id)),
      },
      { status: 201 },
    );
  } catch {
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "RECALC_API_TOKEN_ISSUE_FAILED",
      error: "No fue posible crear el token de API.",
      recoverable: true,
    });
  }
}
