import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { diagnoseAdminQuote } from "@/lib/admin-quote-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_quote_diagnose");
  try {
    const auth = await requireAdminApiCapability(requestId, [
      AdminCapability.manage_prices,
      AdminCapability.manage_offers,
    ]);
    if (!auth.ok) return auth.response;

    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_JSON",
        error: "El cuerpo JSON no es válido.",
        recoverable: true,
      });
    }

    const diagnosis = await diagnoseAdminQuote(payload);
    return adminApiSuccess(requestId, diagnosis);
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-quotes",
      action: "diagnose",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "QUOTE_DIAGNOSIS_FAILED",
      error: "No fue posible diagnosticar la cotización.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
