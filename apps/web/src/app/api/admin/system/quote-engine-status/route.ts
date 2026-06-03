import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { getQuoteEngineStatus } from "@/lib/admin-system-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = buildAdminRequestId("admin_quote_engine_status");
  try {
    const auth = await requireAdminApiCapability(requestId, [
      AdminCapability.manage_prices,
      AdminCapability.manage_offers,
    ]);
    if (!auth.ok) return auth.response;

    return adminApiSuccess(requestId, {
      quoteEngine: await getQuoteEngineStatus(),
    });
  } catch (error) {
    logAdminApiFailure({ requestId, module: "admin-system", action: "quote-engine-status", error });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "QUOTE_ENGINE_STATUS_FAILED",
      error: "No fue posible verificar el motor de cotización.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
