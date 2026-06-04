import { AdminAuditAction, AdminChangeSource, AdminConfigModule } from "@prisma/client";
import { z } from "zod";

import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { createGitHubRepairPullRequest } from "@/lib/agents/auditor/github";
import { createRepairFiles, createRepairPlan } from "@/lib/agents/auditor/repair-plans";
import { GitHubControlError } from "@/lib/admin-github-control";

import { requireAuditorRepairAccess } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const findingSchema = z.object({
  id: z.string().min(1).max(160),
  module: z.enum(["system", "tokens", "oauth", "users", "offers", "quote", "github", "security"]),
  severity: z.enum(["info", "warning", "error", "critical"]),
  title: z.string().min(1).max(240),
  summary: z.string().min(1).max(5_000),
  evidence: z.record(z.string(), z.unknown()).optional(),
  suggestedAction: z.string().max(5_000).optional(),
  repairable: z.boolean(),
  repairActionId: z.string().max(160).optional(),
});

const prSchema = z.object({
  finding: findingSchema,
  confirmation: z.literal("CREATE_REPAIR_PR"),
});

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("agents_auditor_github_pr");
  const auth = await requireAuditorRepairAccess(requestId, "github-pr");
  if (!auth.ok) return auth.response;

  const parsed = prSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_AUDITOR_PR_PAYLOAD",
      error: "Payload invalido o confirmacion faltante para crear PR.",
      details: parsed.error.flatten(),
      recoverable: true,
    });
  }

  const plan = createRepairPlan(parsed.data.finding);
  if (!plan.canCreatePr) {
    return adminApiError({
      requestId,
      status: 422,
      errorCode: "AUDITOR_FINDING_NOT_REPAIRABLE",
      error: "El hallazgo no esta marcado como reparable.",
      recoverable: true,
    });
  }

  try {
    const files = createRepairFiles({ finding: parsed.data.finding, plan });
    const result = await createGitHubRepairPullRequest({
      finding: parsed.data.finding,
      plan,
      files,
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.CREATE,
      source: AdminChangeSource.SYSTEM,
      actor: auth.admin,
      entityType: "AuditorGitHubPullRequest",
      entityId: String(result.pullRequest.number),
      requestId,
      after: {
        findingId: parsed.data.finding.id,
        branch: result.branch,
        files: result.files,
        pullRequest: result.pullRequest,
      },
      message: `PR GitHub Auditor/Reparador creado: #${result.pullRequest.number}.`,
    });

    return adminApiSuccess(requestId, { result, plan }, { status: 201 });
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
      errorCode: "AUDITOR_GITHUB_PR_FAILED",
      error: "No fue posible crear el PR de reparacion.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
