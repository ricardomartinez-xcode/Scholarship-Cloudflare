import { AdminAuditAction, AdminCapability, AdminConfigModule } from "@prisma/client";
import { z } from "zod";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { dispatchGitHubWorkflow, GitHubControlError } from "@/lib/admin-github-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dispatchSchema = z.object({
  workflow_id: z.string().trim().min(1).max(200),
  ref: z.string().trim().min(1).max(200),
  inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_github_dispatch");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.publish_config);
  if (!auth.ok) return auth.response;

  const parsed = dispatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminApiError({
      requestId,
      status: 400,
      errorCode: "INVALID_WORKFLOW_DISPATCH_PAYLOAD",
      error: "Payload inválido para workflow_dispatch.",
      details: parsed.error.flatten(),
      recoverable: true,
    });
  }

  try {
    const result = await dispatchGitHubWorkflow({
      workflowId: parsed.data.workflow_id,
      ref: parsed.data.ref,
      inputs: parsed.data.inputs,
    });

    await writeAdminAuditLog({
      module: AdminConfigModule.ACCESS,
      action: AdminAuditAction.UPDATE,
      actor: auth.admin,
      entityType: "GitHubWorkflow",
      entityId: parsed.data.workflow_id,
      requestId,
      after: {
        workflowId: parsed.data.workflow_id,
        ref: parsed.data.ref,
        inputKeys: Object.keys(parsed.data.inputs ?? {}),
      },
      message: `Workflow GitHub disparado: ${parsed.data.workflow_id}.`,
    });

    return adminApiSuccess(requestId, result, { status: 202 });
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
      errorCode: "GITHUB_WORKFLOW_DISPATCH_FAILED",
      error: "No fue posible disparar el workflow.",
      recoverable: true,
    });
  }
}
