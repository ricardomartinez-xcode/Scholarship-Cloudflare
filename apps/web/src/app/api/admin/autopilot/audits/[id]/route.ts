import { AdminCapability } from "@prisma/client";

import { getAutoAuditRun, serializeAutoAuditRun } from "@/lib/admin-autopilot";
import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { requireAdminApiCapability } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = buildAdminRequestId("admin_autopilot_audit_detail");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.view_reports);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const audit = await getAutoAuditRun(id);
  if (!audit) {
    return adminApiError({
      requestId,
      status: 404,
      errorCode: "AUTO_AUDIT_NOT_FOUND",
      error: "No se encontró la auditoría solicitada.",
      recoverable: true,
    });
  }

  return adminApiSuccess(requestId, { audit: serializeAutoAuditRun(audit) });
}
