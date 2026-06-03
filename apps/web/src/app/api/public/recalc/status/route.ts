import { AdminCapability } from "@prisma/client";

import { GET as adminGET } from "@/app/api/admin/system/status/route";
import { forwardRecalcPublicApiRequest } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return forwardRecalcPublicApiRequest(
    request,
    AdminCapability.view_admin_operations,
    () => adminGET(),
  );
}
