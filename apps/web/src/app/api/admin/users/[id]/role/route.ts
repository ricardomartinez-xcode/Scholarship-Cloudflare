import { AdminAuditAction, AdminCapability, AdminConfigModule, Role } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseRole(value: unknown) {
  if (typeof value !== "string") return null;
  return Object.values(Role).includes(value as Role) ? (value as Role) : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = buildAdminRequestId("admin_user_role");
  try {
    const auth = await requireAdminApiCapability(requestId, AdminCapability.manage_users);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
    const nextRole = parseRole(body?.role);
    if (!nextRole) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_ROLE",
        error: "Rol inválido.",
        details: { allowedRoles: Object.values(Role) },
        recoverable: true,
      });
    }

    const current = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!current) {
      return adminApiError({
        requestId,
        status: 404,
        errorCode: "USER_NOT_FOUND",
        error: "No se encontró el usuario.",
        recoverable: true,
      });
    }

    if (current.role === Role.owner && nextRole !== Role.owner) {
      const otherOwners = await prisma.user.count({
        where: {
          id: { not: id },
          role: Role.owner,
          isActive: true,
        },
      });
      if (otherOwners < 1) {
        return adminApiError({
          requestId,
          status: 409,
          errorCode: "LAST_OWNER_GUARD",
          error: "No se puede dejar el sistema sin owners activos.",
          recoverable: true,
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: nextRole },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.UPDATE,
      actor: auth.admin,
      entityType: "User",
      entityId: id,
      requestId,
      before: { role: current.role },
      after: { role: updated.role },
      message: `Rol de usuario actualizado de ${current.role} a ${updated.role}.`,
    });

    return adminApiSuccess(requestId, {
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        role: updated.role,
        status: updated.isActive ? "active" : "inactive",
        updatedAt: updated.updatedAt.toISOString(),
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
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
