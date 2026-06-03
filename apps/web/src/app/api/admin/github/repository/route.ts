import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { adminApiError, adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { getGitHubRepository, GitHubControlError } from "@/lib/admin-github-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = buildAdminRequestId("admin_github_repository");
  const auth = await requireAdminApiCapability(requestId, AdminCapability.view_reports);
  if (!auth.ok) return auth.response;

  try {
    return adminApiSuccess(requestId, {
      repository: await getGitHubRepository(),
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
      errorCode: "GITHUB_REPOSITORY_FAILED",
      error: "No fue posible consultar el repositorio.",
      recoverable: true,
    });
  }
}
