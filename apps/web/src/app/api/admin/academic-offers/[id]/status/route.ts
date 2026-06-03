import { AdminAuditAction, AdminCapability, AdminConfigModule } from "@prisma/client";

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

function parseActive(body: { active?: unknown; isActive?: unknown; status?: unknown }) {
  if (typeof body.active === "boolean") return body.active;
  if (typeof body.isActive === "boolean") return body.isActive;
  if (typeof body.status === "string") {
    const status = body.status.trim().toLowerCase();
    if (["active", "activo", "enabled"].includes(status)) return true;
    if (["inactive", "inactivo", "disabled"].includes(status)) return false;
  }
  return null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = buildAdminRequestId("admin_academic_offer_status");
  try {
    const auth = await requireAdminApiCapability(requestId, AdminCapability.manage_offers);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | { active?: unknown; isActive?: unknown; status?: unknown; reason?: unknown }
      | null;
    const isActive = body ? parseActive(body) : null;
    if (isActive === null) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_STATUS",
        error: "Envía active=true/false o status active/inactive.",
        recoverable: true,
      });
    }

    const current = await prisma.programOffering.findUnique({
      where: { id },
      select: { id: true, isActive: true, archivedReason: true, cycle: true },
    });
    if (!current) {
      return adminApiError({
        requestId,
        status: 404,
        errorCode: "OFFER_NOT_FOUND",
        error: "No se encontró la oferta académica.",
        recoverable: true,
      });
    }

    const reason =
      typeof body?.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : isActive
          ? null
          : "ADMIN_STATUS_CHANGE";

    const updated = await prisma.programOffering.update({
      where: { id },
      data: {
        isActive,
        archivedAt: isActive ? null : new Date(),
        archivedReason: reason,
        updatedBy: auth.admin.email,
      },
      select: { id: true, isActive: true, archivedAt: true, archivedReason: true, updatedAt: true },
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.OFFER,
      action: AdminAuditAction.UPDATE,
      actor: auth.admin,
      entityType: "ProgramOffering",
      entityId: id,
      requestId,
      before: {
        isActive: current.isActive,
        archivedReason: current.archivedReason,
      },
      after: {
        isActive: updated.isActive,
        archivedReason: updated.archivedReason,
      },
      message: `Oferta académica ${isActive ? "activada" : "desactivada"} desde API admin.`,
    });

    return adminApiSuccess(requestId, {
      offer: {
        ...updated,
        archivedAt: updated.archivedAt?.toISOString() ?? null,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-academic-offers",
      action: "status",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "OFFER_STATUS_UPDATE_FAILED",
      error: "No fue posible actualizar el estado de la oferta.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
