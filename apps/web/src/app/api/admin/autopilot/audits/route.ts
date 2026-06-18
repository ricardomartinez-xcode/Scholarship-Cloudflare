import { AdminAuditAction, AdminCapability, AdminConfigModule } from "@prisma/client";
import { z } from "zod";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  createAutoAuditRun,
  INTERNAL_AUTO_AUDIT_WORKFLOW_ID,
  listAutoAuditRuns,
  markAutoAuditRunFailed,
  serializeAutoAuditRun,
  updateAutoAuditRunDispatch,
} from "@/lib/admin-autopilot";
import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { dispatchGitHubWorkflow, getGitHubRepository, GitHubControlError } from "@/lib/admin-github-control";
import { requireAdminApiCapability } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
  mode: z.enum(["standard", "deep"]).default("standard"),
  ref: z.string().trim().min(1).max(120).optional(),
});

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("admin_autopilot_audits");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.view_reports);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const audits = await listAutoAuditRuns({
    limit: Number.isFinite(limit) ? limit : 20,
  });

  return adminApiSuccess(requestId, {
    audits: audits.map(serializeAutoAuditRun),
  });
}

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_autopilot_audit_create");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.view_reports);
  if (!auth.ok) return auth.response;

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_AUTOPILOT_AUDIT_PAYLOAD",
      error: "Payload inválido para auditoría interna.",
      details: parsed.error.flatten(),
      recoverable: true,
    });
  }

  const repo = await getGitHubRepository();
  const ref = parsed.data.ref ?? repo.defaultBranch;
  const audit = await createAutoAuditRun({
    mode: parsed.data.mode,
    ref,
    actor: { id: auth.admin.id, email: auth.admin.email },
  });

  try {
    await dispatchGitHubWorkflow({
      workflowId: INTERNAL_AUTO_AUDIT_WORKFLOW_ID,
      ref,
      inputs: {
        audit_run_id: audit.id,
        mode: parsed.data.mode,
      },
    });

    const updatedAudit = await updateAutoAuditRunDispatch({
      auditRunId: audit.id,
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.UPDATE,
      actor: auth.admin,
      entityType: "AutoAuditRun",
      entityId: audit.id,
      requestId,
      after: {
        auditRunId: audit.id,
        workflowId: INTERNAL_AUTO_AUDIT_WORKFLOW_ID,
        mode: parsed.data.mode,
        ref,
      },
      message: `Autoauditoría interna disparada: ${audit.id}.`,
    });

    return adminApiSuccess(
      requestId,
      { audit: serializeAutoAuditRun(updatedAudit) },
      { status: 202, message: "Autoauditoría disparada en GitHub Actions." },
    );
  } catch (error) {
    await markAutoAuditRunFailed({
      auditRunId: audit.id,
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
      errorCode: "AUTOPILOT_AUDIT_DISPATCH_FAILED",
      error: "No fue posible disparar la autoauditoría.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
