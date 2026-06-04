import { AdminAuditAction, AdminChangeSource, AdminConfigModule } from "@prisma/client";
import { z } from "zod";

import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { createGitHubIssueFromFinding } from "@/lib/agents/auditor/github";
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

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("agents_auditor_github_issue");
  const auth = await requireAuditorRepairAccess(requestId, "github-issue");
  if (!auth.ok) return auth.response;

  const parsed = z.object({ finding: findingSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_AUDITOR_FINDING",
      error: "Payload invalido para crear issue.",
      details: parsed.error.flatten(),
      recoverable: true,
    });
  }

  try {
    const issue = await createGitHubIssueFromFinding(parsed.data.finding);
    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.CREATE,
      source: AdminChangeSource.SYSTEM,
      actor: auth.admin,
      entityType: "AuditorGitHubIssue",
      entityId: String(issue.number),
      requestId,
      after: {
        findingId: parsed.data.finding.id,
        issueNumber: issue.number,
        issueUrl: issue.url,
      },
      message: `Issue GitHub Auditor/Reparador creado: #${issue.number}.`,
    });

    return adminApiSuccess(requestId, { issue }, { status: 201 });
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
      errorCode: "AUDITOR_GITHUB_ISSUE_FAILED",
      error: "No fue posible crear issue en GitHub.",
      recoverable: true,
    });
  }
}
