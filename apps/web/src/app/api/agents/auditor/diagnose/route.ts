import { AdminAuditAction, AdminChangeSource, AdminConfigModule } from "@prisma/client";

import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { runAuditorDiagnostics } from "@/lib/agents/auditor/diagnostics";

import { requireAuditorReadAccess } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const requestId = buildAdminRequestId("agents_auditor_diagnose");
  const auth = await requireAuditorReadAccess(requestId, "diagnose");
  if (!auth.ok) return auth.response;

  try {
    const diagnosis = await runAuditorDiagnostics();
    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.IMPORT_VALIDATE,
      source: AdminChangeSource.SYSTEM,
      actor: auth.admin,
      entityType: "AuditorDiagnosis",
      entityId: requestId,
      requestId,
      after: {
        summary: diagnosis.summary,
        findingIds: diagnosis.findings.map((finding) => finding.id),
      },
      message: `Diagnostico Auditor/Reparador ejecutado: ${diagnosis.summary.total} hallazgos.`,
    });

    return adminApiSuccess(requestId, { diagnosis });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "agents-auditor",
      action: "diagnose",
      error,
      actorUserId: auth.admin.id,
      actorEmail: auth.admin.email,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "AUDITOR_DIAGNOSE_FAILED",
      error: "No fue posible ejecutar el diagnostico.",
      recoverable: true,
    });
  }
}
