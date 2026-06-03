import { AdminCapability } from "@prisma/client";

import {
  GET as adminGET,
  PATCH as adminPATCH,
} from "@/app/api/admin/config/route";
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

export async function PATCH(request: Request) {
  return forwardRecalcPublicApiRequest(
    request,
    AdminCapability.publish_config,
    () => adminPATCH(request),
  );
}
