import { AdminCapability } from "@prisma/client";

import { POST as adminPOST } from "@/app/api/admin/benefits/import/[sessionId]/apply/route";
import { forwardRecalcPublicApiRequest } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  return forwardRecalcPublicApiRequest(
    request,
    [AdminCapability.view_admin_operations, AdminCapability.manage_benefits],
    () => adminPOST(request, context),
  );
}
