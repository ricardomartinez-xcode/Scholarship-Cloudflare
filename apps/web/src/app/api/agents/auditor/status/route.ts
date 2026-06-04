import { adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { getGitHubStatus } from "@/lib/agents/auditor/github";
import { getRateLimitStoreState } from "@/lib/rate-limit";

import { requireAuditorReadAccess } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = buildAdminRequestId("agents_auditor_status");
  const auth = await requireAuditorReadAccess(requestId, "status");
  if (!auth.ok) return auth.response;

  return adminApiSuccess(requestId, {
    status: {
      github: getGitHubStatus(),
      rateLimit: getRateLimitStoreState(),
      permissions: {
        read: "view_admin_operations",
        repair: "owner",
        currentUserIsOwner: auth.admin.isSystemOwner,
      },
    },
  });
}
