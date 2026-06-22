import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import { adminApiError, adminApiSuccess, buildAdminRequestId, logAdminApiFailure } from "@/lib/admin-api";
import { getPublishedPriceCoverageReport } from "@/lib/importers/price-coverage-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCycle(request: Request) {
  const cycle = new URL(request.url).searchParams.get("cycle")?.trim() ?? "";
  return cycle || null;
}

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("admin_prices_coverage");

  try {
    const auth = await requireAdminApiCapability(requestId, [
      AdminCapability.manage_prices,
      AdminCapability.manage_offers,
    ]);
    if (!auth.ok) return auth.response;

    const report = await getPublishedPriceCoverageReport({ cycle: readCycle(request) });
    return adminApiSuccess(requestId, report);
  } catch (error) {
    logAdminApiFailure({ requestId, module: "admin-prices-coverage", action: "read", error });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "PRICE_COVERAGE_REPORT_FAILED",
      error: "No fue posible generar el reporte de cobertura de precios.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
