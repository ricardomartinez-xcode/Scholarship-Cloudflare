import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { adminApiSuccess, buildAdminRequestId } from "@/lib/admin-api";
import { getAdminEnvCheck } from "@/lib/admin-system-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = buildAdminRequestId("admin_system_env_check");
  const auth = await requireAdminApiCapability(
    requestId,
    AdminCapability.view_admin_operations,
  );
  if (!auth.ok) return auth.response;

  return adminApiSuccess(requestId, {
    env: getAdminEnvCheck(),
  });
}
