import { AdminCapability, Prisma } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { parseAdminPagination } from "@/lib/admin-control-api";
import { normalizeCanonicalModality } from "@/lib/pricing-normalize";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildWhere(searchParams: URLSearchParams): Prisma.ProgramOfferingWhereInput {
  const cycle = searchParams.get("cycle")?.trim();
  const campus = searchParams.get("campus")?.trim();
  const program = searchParams.get("program")?.trim();
  const plan = Number(searchParams.get("plan") ?? "");
  const status = searchParams.get("status")?.trim().toLowerCase();
  const modality = normalizeCanonicalModality(searchParams.get("modalidad") ?? searchParams.get("modality"));

  return {
    ...(cycle ? { cycle } : {}),
    ...(Number.isInteger(plan) && plan > 0 ? { pricingPlans: { has: plan } } : {}),
    ...(status === "active" || status === "activo" ? { isActive: true } : {}),
    ...(status === "inactive" || status === "inactivo" ? { isActive: false } : {}),
    ...(campus
      ? {
          campus: {
            OR: [
              { code: { equals: campus, mode: "insensitive" } },
              { metaKey: { equals: campus, mode: "insensitive" } },
              { name: { contains: campus, mode: "insensitive" } },
              { slug: { equals: campus, mode: "insensitive" } },
            ],
          },
        }
      : {}),
    ...(program
      ? {
          program: {
            OR: [
              { name: { contains: program, mode: "insensitive" } },
              { nameNormalized: { contains: program, mode: "insensitive" } },
            ],
          },
        }
      : {}),
    ...(modality === "online"
      ? { delivery: "ONLINE" }
      : modality === "mixta"
        ? { delivery: "CAMPUS", ejecutivo: true }
        : modality === "presencial"
          ? { delivery: "CAMPUS", escolarizado: true }
          : {}),
  };
}

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("admin_academic_offers");
  try {
    const auth = await requireAdminApiCapability(requestId, AdminCapability.manage_offers);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const pagination = parseAdminPagination(url.searchParams, {
      defaultPageSize: 50,
      maxPageSize: 200,
    });
    const where = buildWhere(url.searchParams);

    const [total, rows] = await Promise.all([
      prisma.programOffering.count({ where }),
      prisma.programOffering.findMany({
        where,
        orderBy: [{ cycle: "desc" }, { updatedAt: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
        select: {
          id: true,
          cycle: true,
          track: true,
          delivery: true,
          escolarizado: true,
          ejecutivo: true,
          pricingPlans: true,
          moduleCount: true,
          subjectsByModule: true,
          lineOfBusiness: true,
          isActive: true,
          archivedAt: true,
          archivedReason: true,
          updatedBy: true,
          createdAt: true,
          updatedAt: true,
          campus: {
            select: { id: true, code: true, name: true, metaKey: true, tier: true, kind: true },
          },
          program: {
            select: { id: true, name: true, businessLine: true, level: true, category: true },
          },
        },
      }),
    ]);

    return adminApiSuccess(requestId, {
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
      },
      offers: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        archivedAt: row.archivedAt?.toISOString() ?? null,
      })),
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
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
