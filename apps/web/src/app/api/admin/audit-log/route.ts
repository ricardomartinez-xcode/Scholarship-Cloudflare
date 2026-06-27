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
import { listD1AuditEvents } from "@/lib/d1/audit-log";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("admin_audit_log");

  try {
    const operationsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_admin_operations,
    );
    if (!operationsAuth.ok) return operationsAuth.response;

    const reportsAuth = await requireAdminApiCapability(
      requestId,
      AdminCapability.view_reports,
    );
    if (!reportsAuth.ok) return reportsAuth.response;

    const url = new URL(request.url);
    const pagination = parseAdminPagination(url.searchParams, {
      defaultPageSize: 50,
      maxPageSize: 200,
    });

    const result = await listD1AuditEvents(getD1(), {
      page: pagination.page,
      pageSize: pagination.pageSize,
      action: url.searchParams.get("action"),
      resourceType: url.searchParams.get("module"),
      actor: url.searchParams.get("user"),
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });

    return adminApiSuccess(requestId, {
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: result.total,
      },
      events: result.events.map((event) => ({
        id: event.id,
        module: event.resourceType,
        action: event.action,
        source: event.actor.type,
        user: {
          id: event.actor.id,
          email: event.actor.email,
        },
        entity: {
          type: event.resourceType,
          id: event.resourceId,
        },
        requestId: event.requestId,
        summary:
          typeof event.metadata.summary === "string"
            ? event.metadata.summary
            : event.action,
        metadata: event.metadata,
        importSessionId:
          typeof event.metadata.importSessionId === "string"
            ? event.metadata.importSessionId
            : null,
        versionId:
          typeof event.metadata.versionId === "string"
            ? event.metadata.versionId
            : null,
        createdAt: event.createdAt,
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
      details: {
        reason: error instanceof Error ? error.message : String(error),
      },
      recoverable: true,
    });
  }
}
