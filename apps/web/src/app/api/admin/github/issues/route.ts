import { AdminAuditAction, AdminCapability, AdminConfigModule } from "@prisma/client";
import { z } from "zod";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { createGitHubIssue, GitHubControlError } from "@/lib/admin-github-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const issueSchema = z.object({
  title: z.string().trim().min(1).max(256),
  body: z.string().max(65_000).optional(),
  labels: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_github_issue");
  const auth = await requireAdminApiCapability(
    requestId,
    AdminCapability.view_admin_operations,
  );
  if (!auth.ok) return auth.response;

  const parsed = issueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_ISSUE_PAYLOAD",
      error: "Payload inválido para crear issue.",
      details: parsed.error.flatten(),
      recoverable: true,
    });
  }

  try {
    const issue = await createGitHubIssue(parsed.data);
    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.CREATE,
      actor: auth.admin,
      entityType: "GitHubIssue",
      entityId: String(issue.number),
      requestId,
      after: {
        number: issue.number,
        title: issue.title,
        labels: parsed.data.labels ?? [],
        url: issue.url,
      },
      message: `Issue GitHub creado: #${issue.number}.`,
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
      errorCode: "GITHUB_ISSUE_CREATE_FAILED",
      error: "No fue posible crear el issue.",
      recoverable: true,
    });
  }
}
