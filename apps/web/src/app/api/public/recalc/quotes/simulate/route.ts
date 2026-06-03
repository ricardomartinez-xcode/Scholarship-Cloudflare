import { AdminCapability } from "@prisma/client";

import { POST as adminPOST } from "@/app/api/admin/quotes/simulate/route";
import { forwardRecalcPublicApiRequest } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return forwardRecalcPublicApiRequest(
    request,
    [AdminCapability.manage_prices, AdminCapability.manage_offers],
    () => adminPOST(request),
  );
}
