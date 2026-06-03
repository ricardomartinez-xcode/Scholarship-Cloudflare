import { AdminCapability } from "@prisma/client";

import { PATCH as adminPATCH } from "@/app/api/admin/academic-offers/[id]/status/route";
import { forwardRecalcPublicApiRequest } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return forwardRecalcPublicApiRequest(
    request,
    AdminCapability.manage_offers,
    () => adminPATCH(request, context),
  );
}
