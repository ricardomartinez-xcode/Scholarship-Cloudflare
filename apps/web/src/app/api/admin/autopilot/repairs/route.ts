import { AdminAuditAction, AdminCapability, AdminConfigModule } from "@prisma/client";
import { z } from "zod";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  createAutoRepairRun,
  getAutoAuditRun,
  INTERNAL_AUTO_REPAIR_WORKFLOW_ID,
  listAutoRepairRuns,
  markAutoRepairRunFailed,
  serializeAutoRepairRun,
  updateAutoRepairRunDispatch,
} from "@/lib/admin-autopilot";
import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { dispatchGitHubWorkflow, getGitHubRepository, GitHubControlError } from "@/lib/admin-github-control";
import { requireAdminApiCapability } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
  auditRunId: z.string().trim().min(1).max(120),
  findingIds: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
});

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("admin_autopilot_repairs");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.view_reports);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const repairs = await listAutoRepairRuns({
    limit: Number.isFinite(limit) ? limit : 20,
  });

  return adminApiSuccess(requestId, {
    repairs: repairs.map(serializeAutoRepairRun),
  });
}

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_autopilot_repair_create");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.publish_config);
  if (!auth.ok) return auth.response;

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_AUTOPILOT_REPAIR_PAYLOAD",
      error: "Payload inválido para reparación interna.",
      details: parsed.error.flatten(),
      recoverable: true,
    });
  }

  const audit = await getAutoAuditRun(parsed.data.auditRunId);
  if (!audit) {
    return adminApiError({
      requestId,
      status: 404,
      errorCode: "AUTO_AUDIT_NOT_FOUND",
      error: "No se encontró la auditoría solicitada.",
      recoverable: true,
    });
  }

  const selectedFindingIds = new Set(parsed.data.findingIds);
  const selectedFindings = audit.findings.filter((finding) =>
    selectedFindingIds.size
      ? selectedFindingIds.has(finding.id) || selectedFindingIds.has(finding.checkId)
      : finding.repairable,
  );
  const repairCheckIds = Array.from(
    new Set(selectedFindings.filter((finding) => finding.repairable).map((finding) => finding.checkId)),
  );

  const repo = await getGitHubRepository();
  const repair = await createAutoRepairRun({
    auditRunId: parsed.data.auditRunId,
    findingIds: parsed.data.findingIds,
    actor: { id: auth.admin.id, email: auth.admin.email },
  });

  try {
    await dispatchGitHubWorkflow({
      workflowId: INTERNAL_AUTO_REPAIR_WORKFLOW_ID,
      ref: repo.defaultBranch,
      inputs: {
        audit_run_id: parsed.data.auditRunId,
        repair_run_id: repair.id,
        finding_ids: repairCheckIds.join(","),
      },
    });

    const updatedRepair = await updateAutoRepairRunDispatch({
      repairRunId: repair.id,
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.UPDATE,
      actor: auth.admin,
      entityType: "AutoRepairRun",
      entityId: repair.id,
      requestId,
      after: {
        repairRunId: repair.id,
        auditRunId: parsed.data.auditRunId,
        workflowId: INTERNAL_AUTO_REPAIR_WORKFLOW_ID,
        findingIds: parsed.data.findingIds,
      },
      message: `Autoreparación interna disparada: ${repair.id}.`,
    });

    return adminApiSuccess(
      requestId,
      { repair: serializeAutoRepairRun(updatedRepair) },
      { status: 202, message: "Autoreparación disparada en GitHub Actions." },
    );
  } catch (error) {
    await markAutoRepairRunFailed({
      repairRunId: repair.id,
      error: error instanceof Error ? error.message : String(error),
    });

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
      errorCode: "AUTOPILOT_REPAIR_DISPATCH_FAILED",
      error: "No fue posible disparar la autoreparación.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
