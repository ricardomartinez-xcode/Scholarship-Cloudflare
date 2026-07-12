import { AdminCapability } from "@prisma/client";

import { requireAdminApiCapability } from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { getAuthSyncDiagnostics } from "@/services/authSyncService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const requestId = buildAdminRequestId("admin_auth_sync");
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

    const diagnostics = await getAuthSyncDiagnostics({ analysisLimit: 2500 });

    const supabaseOnly = diagnostics.supabaseOnly.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      created_at: row.createdAt,
    }));
    const appOrphans = diagnostics.appOrphans.map((record) => ({
      id: record.user.id,
      email: record.user.email,
      role: record.user.role,
      isActive: record.user.isActive,
      authUserId: record.user.authUserId,
      createdAt: record.user.createdAt,
      reason: record.reason,
      severity: record.severity,
    }));

    return adminApiSuccess(
      requestId,
      {
        supabaseAuthAvailable: diagnostics.supabaseAuthAvailable,
        supabaseAuthWarning: diagnostics.supabaseAuthWarning,
        warnings: diagnostics.warnings,
        summary: {
          supabaseOnlyCount: diagnostics.summary.supabaseOnlyCount,
          appOrphansCount: diagnostics.summary.appOrphansCount,
        },
        supabaseOnly,
        appOrphans,
      },
      {
        message: "Diagnóstico de auth sync generado.",
      },
    );
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-auth-sync",
      action: "get",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "AUTH_SYNC_FAILED",
      error: "No fue posible cargar el diagnóstico de sincronización.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
