import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { parseAdminPagination } from "@/lib/admin-control-api";
import { getD1 } from "@/lib/cloudflare/d1";
import {
  listD1AcademicOffers,
  type AcademicOfferModality,
} from "@/lib/d1/academic-offers";
import { normalizeCanonicalModality } from "@/lib/pricing-normalize";

export const dynamic = "force-dynamic";

function parseStatus(value: string | null): "active" | "inactive" | null {
  const status = value?.trim().toLowerCase();
  if (status === "active" || status === "activo") return "active";
  if (status === "inactive" || status === "inactivo") return "inactive";
  return null;
}

function parsePlan(value: string | null): number | null {
  const plan = Number(value ?? "");
  return Number.isInteger(plan) && plan > 0 ? plan : null;
}

function parseModality(value: string | null): AcademicOfferModality {
  const normalized = normalizeCanonicalModality(value);
  return normalized === "online" || normalized === "mixta" || normalized === "presencial"
    ? normalized
    : null;
}

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("admin_academic_offers");

  try {
    const auth = await requireAdminApiCapability(
      requestId,
      AdminCapability.manage_offers,
    );
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const pagination = parseAdminPagination(url.searchParams, {
      defaultPageSize: 50,
      maxPageSize: 200,
    });

    const result = await listD1AcademicOffers(getD1(), {
      page: pagination.page,
      pageSize: pagination.pageSize,
      cycle: url.searchParams.get("cycle"),
      campus: url.searchParams.get("campus"),
      program: url.searchParams.get("program"),
      plan: parsePlan(url.searchParams.get("plan")),
      status: parseStatus(url.searchParams.get("status")),
      modality: parseModality(
        url.searchParams.get("modalidad") ?? url.searchParams.get("modality"),
      ),
    });

    return adminApiSuccess(requestId, {
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: result.total,
      },
      offers: result.offers,
    });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-academic-offers",
      action: "list",
      error,
    });

    return adminApiError({
      requestId,
      status: 500,
      errorCode: "ACADEMIC_OFFERS_LIST_FAILED",
      error: "No fue posible listar ofertas académicas.",
      details: {
        reason: error instanceof Error ? error.message : String(error),
      },
      recoverable: true,
    });
  }
}
