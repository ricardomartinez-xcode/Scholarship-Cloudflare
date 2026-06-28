import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { getD1 } from "@/lib/cloudflare/d1";
import { setD1AcademicOfferStatus } from "@/lib/d1/academic-offer-status";

export const dynamic = "force-dynamic";

function parseActive(body: {
  active?: unknown;
  isActive?: unknown;
  status?: unknown;
}) {
  if (typeof body.active === "boolean") return body.active;
  if (typeof body.isActive === "boolean") return body.isActive;
  if (typeof body.status === "string") {
    const status = body.status.trim().toLowerCase();
    if (["active", "activo", "enabled"].includes(status)) return true;
    if (["inactive", "inactivo", "disabled"].includes(status)) return false;
  }
  return null;
}

function parseReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = buildAdminRequestId("admin_academic_offer_status");
  try {
    const auth = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_offers,
    );
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | {
          active?: unknown;
          isActive?: unknown;
          status?: unknown;
          reason?: unknown;
        }
      | null;
    const isActive = body ? parseActive(body) : null;

    if (!id.trim()) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_OFFER_ID",
        error: "El identificador de la oferta es obligatorio.",
        recoverable: true,
      });
    }
    if (isActive === null) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_STATUS",
        error: "Envía active=true/false o status active/inactive.",
        recoverable: true,
      });
    }

    const result = await setD1AcademicOfferStatus(getD1(), {
      id: id.trim(),
      isActive,
      reason: parseReason(body?.reason),
      actorUserId: auth.admin.id,
      actorEmail: auth.admin.email,
      requestId,
    });

    if (!result.ok) {
      return adminApiError({
        requestId,
        status: 404,
        errorCode: "OFFER_NOT_FOUND",
        error: "No se encontró la oferta académica.",
        recoverable: true,
      });
    }

    return adminApiSuccess(requestId, {
      offer: {
        id: result.offer.id,
        isActive: result.offer.isActive,
        archivedAt: result.offer.archivedAt,
        archivedReason: result.offer.archivedReason,
        updatedAt: result.offer.updatedAt,
      },
      changed: result.changed,
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
