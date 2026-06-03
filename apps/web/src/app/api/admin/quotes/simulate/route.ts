import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { runAdminQuoteSimulation } from "@/lib/admin-quote-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_quote_simulate");
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

    const simulation = await runAdminQuoteSimulation(payload);
    if (!simulation.ok) {
      const errorCode =
        "errorCode" in simulation && simulation.errorCode
          ? simulation.errorCode
          : "QUOTE_NOT_RESOLVED";
      const errorMessage =
        "error" in simulation && simulation.error
          ? simulation.error
          : "No fue posible cotizar la combinación.";
      return adminApiError({
        requestId,
        status: simulation.status,
        errorCode,
        error: errorMessage,
        details: simulation,
        recoverable: true,
      });
    }

    return adminApiSuccess(requestId, {
      result: simulation.result,
      diagnostics: simulation.diagnostics,
    });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-quotes",
      action: "simulate",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "QUOTE_SIMULATION_FAILED",
      error: "No fue posible simular la cotización.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
