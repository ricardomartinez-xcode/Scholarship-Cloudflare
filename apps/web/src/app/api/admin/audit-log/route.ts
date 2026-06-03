import { AdminAuditAction, AdminCapability, AdminConfigModule, Prisma } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { parseAdminPagination } from "@/lib/admin-control-api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseEnum<T extends Record<string, string>>(source: T, value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return Object.values(source).includes(normalized) ? (normalized as T[keyof T]) : null;
}

function buildWhere(searchParams: URLSearchParams): Prisma.AdminAuditLogWhereInput {
  const action = parseEnum(AdminAuditAction, searchParams.get("action"));
  const moduleFilter = parseEnum(AdminConfigModule, searchParams.get("module"));
  const user = searchParams.get("user")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  return {
    ...(action ? { action } : {}),
    ...(moduleFilter ? { module: moduleFilter } : {}),
    ...(user ? { actorEmail: { contains: user, mode: "insensitive" } } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };
}

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("admin_audit_log");
  try {
    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) return operationsAuth.response;

    const auth = await requireAdminApiCapability(requestId, AdminCapability.view_reports);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const pagination = parseAdminPagination(url.searchParams, {
      defaultPageSize: 50,
      maxPageSize: 200,
    });
    const where = buildWhere(url.searchParams);

    const [total, rows] = await Promise.all([
      prisma.adminAuditLog.count({ where }),
      prisma.adminAuditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
        select: {
          id: true,
          module: true,
          action: true,
          source: true,
          actorUserId: true,
          actorEmail: true,
          entityType: true,
          entityId: true,
          requestId: true,
          diffSummary: true,
          message: true,
          importSessionId: true,
          versionId: true,
          createdAt: true,
        },
      }),
    ]);

    return adminApiSuccess(requestId, {
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
      },
      events: rows.map((row) => ({
        id: row.id,
        module: row.module,
        action: row.action,
        source: row.source,
        user: {
          id: row.actorUserId,
          email: row.actorEmail,
        },
        entity: {
          type: row.entityType,
          id: row.entityId,
        },
        requestId: row.requestId,
        summary: row.message,
        metadata: row.diffSummary,
        importSessionId: row.importSessionId,
        versionId: row.versionId,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-audit-log",
      action: "list",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "AUDIT_LOG_LIST_FAILED",
      error: "No fue posible cargar la auditoría.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
