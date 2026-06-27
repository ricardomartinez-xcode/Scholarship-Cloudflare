import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { getD1 } from "@/lib/cloudflare/d1";
import {
  CLOUDFLARE_AUTH_ROLES,
  isCloudflareAuthRole,
  updateD1AuthUserRole,
} from "@/lib/d1/users";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = buildAdminRequestId("admin_user_role");

  try {
    const auth = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_users,
    );
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | { role?: unknown }
      | null;
    const role = body?.role;

    if (!isCloudflareAuthRole(role)) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_ROLE",
        error: "Rol inválido.",
        details: { allowedRoles: CLOUDFLARE_AUTH_ROLES },
        recoverable: true,
      });
    }

    const result = await updateD1AuthUserRole(getD1(), {
      id,
      role,
      actorUserId: auth.admin.id,
      requestId,
    });

    if (!result.ok && result.reason === "not_found") {
      return adminApiError({
        requestId,
        status: 404,
        errorCode: "USER_NOT_FOUND",
        error: "No se encontró el usuario.",
        recoverable: true,
      });
    }
    if (!result.ok && result.reason === "last_owner_guard") {
      return adminApiError({
        requestId,
        status: 409,
        errorCode: "LAST_OWNER_GUARD",
        error: "No se puede dejar el sistema sin owners activos.",
        recoverable: true,
      });
    }
    if (!result.ok) {
      throw new Error("No fue posible actualizar el rol de usuario.");
    }

    return adminApiSuccess(requestId, {
      user: {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        role: result.user.role,
        status: result.user.isActive ? "active" : "inactive",
        updatedAt: result.user.updatedAt,
      },
    });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-users",
      action: "role",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "USER_ROLE_UPDATE_FAILED",
      error: "No fue posible actualizar el rol.",
      details: {
        reason: error instanceof Error ? error.message : String(error),
      },
      recoverable: true,
    });
  }
}
