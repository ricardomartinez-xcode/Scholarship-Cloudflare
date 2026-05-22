import { AdminCapability } from "@prisma/client";
import { z } from "zod";

import {
  type ApiAdminUser,
  requireAdminApiCapability,
} from "@/lib/api-auth";
import {
  adminApiError,
  adminApiSuccess,
  buildAdminRequestId,
  logAdminApiFailure,
} from "@/lib/admin-api";
import { getAuthSyncDiagnostics } from "@/services/authSyncService";
import {
  isRepairActionId,
  previewRepairAction,
  type RepairActionId,
} from "@/services/repairActionsService";
import {
  executeSyncRepairAction,
  generateSyncOperationalReport,
} from "@/services/syncReportService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const postSchema = z.object({
  mode: z.enum(["preview", "apply"]).default("preview"),
  actionId: z.string().min(1),
});

const APPLY_CAPABILITIES: Record<RepairActionId, AdminCapability[]> = {
  "auth.link_missing_by_email": [
    AdminCapability.view_admin_operations,
    AdminCapability.manage_users,
  ],
  "auth.repair_broken_auth_reference": [
    AdminCapability.view_admin_operations,
    AdminCapability.manage_users,
  ],
  "auth.deactivate_orphans": [
    AdminCapability.view_admin_operations,
    AdminCapability.manage_users,
  ],
  "auth.create_minimal_app_users": [
    AdminCapability.view_admin_operations,
    AdminCapability.manage_users,
  ],
  "campaigns.reset_stuck_processing": [
    AdminCapability.view_admin_operations,
    AdminCapability.manage_ctas,
  ],
  "config.normalize_cta_placement": [
    AdminCapability.view_admin_operations,
    AdminCapability.manage_ctas,
    AdminCapability.publish_config,
  ],
};

async function requireAllCapabilities(
  requestId: string,
  capabilities: AdminCapability[],
): Promise<
  | { ok: true; admin: ApiAdminUser }
  | { ok: false; response: Response }
> {
  let admin: ApiAdminUser | null = null;
  for (const capability of capabilities) {
    const result = await requireAdminApiCapability(requestId, capability);
    if (!result.ok) return { ok: false, response: result.response };
    admin = result.admin;
  }
  if (!admin) {
    return {
      ok: false,
      response: adminApiError({
        requestId,
        status: 401,
        errorCode: "UNAUTHORIZED",
        error: "Sesión no autorizada para ejecutar esta acción.",
        recoverable: true,
      }),
    };
  }
  return { ok: true, admin };
}

export async function GET(request: Request) {
  const requestId = buildAdminRequestId("admin_sync_report");
  try {
    const auth = await requireAllCapabilities(requestId, [
      AdminCapability.view_admin_operations,
      AdminCapability.view_reports,
    ]);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const analysisLimit = Number(url.searchParams.get("analysisLimit") ?? "2500");
    const boundedAnalysisLimit = Number.isFinite(analysisLimit)
      ? Math.max(100, Math.min(analysisLimit, 10000))
      : 2500;

    const report = await generateSyncOperationalReport({
      requestId,
      analysisLimit: boundedAnalysisLimit,
    });

    return adminApiSuccess(requestId, report, {
      message: "Reporte operativo de sincronización generado.",
    });
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-sync-report",
      action: "get",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "SYNC_REPORT_FAILED",
      error: "No fue posible generar el reporte de sincronización.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}

export async function POST(request: Request) {
  const requestId = buildAdminRequestId("admin_sync_report_repair");
  try {
    const rawBody = await request.json().catch(() => null);
    const payload = postSchema.safeParse(rawBody);
    if (!payload.success) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "INVALID_BODY",
        error: "Cuerpo inválido para acción de reparación.",
        details: payload.error.flatten(),
        recoverable: true,
      });
    }

    const actionIdRaw = payload.data.actionId.trim();
    if (!isRepairActionId(actionIdRaw)) {
      return adminApiError({
        requestId,
        status: 400,
        errorCode: "UNKNOWN_ACTION",
        error: `Acción de reparación no soportada: ${actionIdRaw}`,
        details: { actionId: actionIdRaw },
        recoverable: true,
      });
    }

    const capabilities =
      payload.data.mode === "apply"
        ? APPLY_CAPABILITIES[actionIdRaw]
        : [AdminCapability.view_admin_operations, AdminCapability.view_reports];

    const auth = await requireAllCapabilities(requestId, capabilities);
    if (!auth.ok) return auth.response;

    if (payload.data.mode === "preview") {
      const diagnostics = await getAuthSyncDiagnostics({ analysisLimit: 5000 });
      const preview = await previewRepairAction({
        actionId: actionIdRaw,
        diagnostics,
        previewLimit: 40,
      });
      return adminApiSuccess(
        requestId,
        { mode: "preview", action: preview },
        { message: `Previsualización de reparación: ${preview.name}` },
      );
    }

    const result = await executeSyncRepairAction({
      requestId,
      actionId: actionIdRaw,
      actor: { id: auth.admin.id, email: auth.admin.email },
    });

    return adminApiSuccess(
      requestId,
      { mode: "apply", action: result },
      { message: `Reparación aplicada: ${result.name}` },
    );
  } catch (error) {
    logAdminApiFailure({
      requestId,
      module: "admin-sync-report",
      action: "post",
      error,
    });
    return adminApiError({
      requestId,
      status: 500,
      errorCode: "SYNC_REPAIR_FAILED",
      error: "No fue posible ejecutar la acción de reparación.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      recoverable: true,
    });
  }
}
