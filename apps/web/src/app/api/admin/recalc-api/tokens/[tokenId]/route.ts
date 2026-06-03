import { AdminAuditAction, AdminCapability, AdminConfigModule } from "@prisma/client";
import { z } from "zod";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { revokeIssuedExtensionSessionTokenById } from "@/lib/extension-session-tokens";
import { RECALC_PUBLIC_API_SCOPE } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  tokenId: z.string().uuid(),
});

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  const requestId = buildAdminRequestId("admin_recalc_api_token_revoke");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.view_admin_operations);
  if (!auth.ok) return auth.response;

  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_RECALC_API_TOKEN_ID",
      error: "Token id inválido.",
      details: parsed.error.flatten(),
      recoverable: true,
    });
  }

  try {
    const revoked = await revokeIssuedExtensionSessionTokenById({
      tokenId: parsed.data.tokenId,
      userId: auth.admin.id,
      scope: RECALC_PUBLIC_API_SCOPE,
    });

    if (revoked) {
      await writeAdminAuditLog({
        module: AdminConfigModule.ACCESS,
        action: AdminAuditAction.DELETE,
        actor: auth.admin,
        entityType: "PublicApiToken",
        entityId: parsed.data.tokenId,
        requestId,
        after: {
          revoked: true,
          scope: RECALC_PUBLIC_API_SCOPE,
        },
        message: "Token API Recalc revocado.",
      });
    }

    return adminApiSuccess(requestId, { revoked });
  } catch {
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "RECALC_API_TOKEN_REVOKE_FAILED",
      error: "No fue posible revocar el token de API.",
      recoverable: true,
    });
  }
}
