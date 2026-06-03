import { AdminCapability } from "@prisma/client";

import { GET as adminGET } from "@/app/api/admin/system/quote-engine-status/route";
import { forwardRecalcPublicApiRequest } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return forwardRecalcPublicApiRequest(
    request,
    [AdminCapability.manage_prices, AdminCapability.manage_offers],
    () => adminGET(),
  );
}
