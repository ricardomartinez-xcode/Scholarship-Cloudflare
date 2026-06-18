import { AdminAuditAction, AdminCapability, AdminConfigModule } from "@prisma/client";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { serializeAutoAuditRun, syncAutoAuditRunFromGitHub } from "@/lib/admin-autopilot";
import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { GitHubControlError } from "@/lib/admin-github-control";
import { requireAdminApiCapability } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = buildAdminRequestId("admin_autopilot_audit_sync");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.view_reports);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const result = await syncAutoAuditRunFromGitHub(id);
    if (!result) {
      return adminApiError({
        requestId,
        status: 404,
        errorCode: "AUTO_AUDIT_NOT_FOUND",
        error: "No se encontró la auditoría solicitada.",
        recoverable: true,
      });
    }

    if (result.synced) {
      await writeAdminAuditLog({
        module: AdminConfigModule.ACCESS,
        action: AdminAuditAction.UPDATE,
        actor: auth.admin,
        entityType: "AutoAuditRun",
        entityId: id,
        requestId,
        after: {
          auditRunId: id,
          synced: true,
          findingCount: result.audit.findings.length,
        },
        message: `Autoauditoría sincronizada: ${id}.`,
      });
    }

    return adminApiSuccess(requestId, {
      synced: result.synced,
      message: result.message,
      audit: serializeAutoAuditRun(result.audit),
    });
  } catch (error) {
    if (error instanceof GitHubControlError) {
      return adminApiError({
        requestId,
        status: error.status,
        errorCode: error.code,
        error: error.message,
        details: error.details,
        recoverable: true,
      });
    }

    return adminApiError({
      requestId,
      status: 500,
      errorCode: "AUTO_AUDIT_SYNC_FAILED",
      error: "No fue posible sincronizar la auditoría.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
