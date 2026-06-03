import { AdminCapability } from "@prisma/client";

import { GET as adminGET } from "@/app/api/admin/audit-log/route";
import { forwardRecalcPublicApiRequest } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return forwardRecalcPublicApiRequest(
    request,
    [AdminCapability.view_admin_operations, AdminCapability.view_reports],
    () => adminGET(request),
  );
}
