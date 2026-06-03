import { AdminCapability } from "@prisma/client";

import { POST as adminPOST } from "@/app/api/admin/github/actions/dispatch/route";
import { forwardRecalcPublicApiRequest } from "@/lib/recalc-public-control-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return forwardRecalcPublicApiRequest(
    request,
    AdminCapability.publish_config,
    () => adminPOST(request),
  );
}
