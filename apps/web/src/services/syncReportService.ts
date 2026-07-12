import type { SyncSeverity } from "@/services/authSyncService";
import {
  type AuthSyncDiagnostics,
  getAuthSyncDiagnostics,
} from "@/services/authSyncService";
import {
  type RepairActionId,
  executeRepairAction,
  listRepairActionPreviews,
  type RepairExecutionResult,
  type RepairPreviewResult,
} from "@/services/repairActionsService";

export type SyncReportFinding = {
  id: string;
  title: string;
  message: string;
  severity: SyncSeverity;
  count: number;
  recoverable: boolean;
  suggestedActions: RepairActionId[];
  sample: Array<Record<string, unknown>>;
};

export type SyncOperationalReport = {
  generatedAt: string;
  requestId: string;
  diagnostics: AuthSyncDiagnostics;
  findings: SyncReportFinding[];
  repairActions: RepairPreviewResult[];
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    recoverableFindings: number;
    safeAutoFixActions: number;
    reviewRequiredActions: number;
  };
};

function toSample(details: Record<string, unknown>[]) {
  return details.slice(0, 6);
}

function pushFinding(
  findings: SyncReportFinding[],
  finding: Omit<SyncReportFinding, "sample"> & { sample?: Array<Record<string, unknown>> },
) {
  if (!finding.count) return;
  findings.push({
    ...finding,
    sample: toSample(finding.sample ?? []),
  });
}

export async function generateSyncOperationalReport(params: {
  requestId: string;
  analysisLimit?: number;
}): Promise<SyncOperationalReport> {
  const diagnostics = await getAuthSyncDiagnostics({
    analysisLimit: params.analysisLimit,
  });

  const findings: SyncReportFinding[] = [];

  if (!diagnostics.supabaseAuthAvailable) {
    pushFinding(findings, {
      id: "supabase-auth-unavailable",
      title: "Supabase Auth Admin API no disponible",
      message:
        diagnostics.supabaseAuthWarning ??
        "No se pudo consultar Supabase Auth Admin API para completar el diagnóstico.",
      severity: "critical",
      count: 1,
      recoverable: false,
      suggestedActions: [],
    });
  }

  pushFinding(findings, {
    id: "supabase-only-users",
    title: "Usuarios solo en Supabase Auth",
    message:
      "Estas cuentas autenticadas todavía no tienen fila en recalc_admin.user o no cumplen condiciones de alta.",
    severity: "medium",
    count: diagnostics.summary.supabaseOnlyCount,
    recoverable: true,
    suggestedActions: ["auth.create_minimal_app_users"],
    sample: diagnostics.supabaseOnly.map((row) => ({
      id: row.id,
      email: row.email,
      createdAt: row.createdAt,
    })),
  });

  pushFinding(findings, {
    id: "app-orphans",
    title: "Usuarios huérfanos en app",
    message:
      "Usuarios con authUserId faltante o roto. Riesgo de acceso inconsistente y bloqueo de autenticación.",
    severity: "high",
    count: diagnostics.summary.appOrphansCount,
    recoverable: true,
    suggestedActions: [
      "auth.link_missing_by_email",
      "auth.repair_broken_auth_reference",
      "auth.deactivate_orphans",
    ],
    sample: diagnostics.appOrphans.map((row) => ({
      userId: row.user.id,
      email: row.user.email,
      role: row.user.role,
      isActive: row.user.isActive,
      reason: row.reason,
    })),
  });

  pushFinding(findings, {
    id: "missing-auth-link",
    title: "Referencias authUserId faltantes",
    message:
      "Usuarios de app sin authUserId pero con match seguro por email en Supabase Auth.",
    severity: "medium",
    count: diagnostics.summary.missingAuthUserIdMatchesCount,
    recoverable: true,
    suggestedActions: ["auth.link_missing_by_email"],
    sample: diagnostics.missingAuthUserIdMatches.map((row) => ({
      userId: row.user.id,
      email: row.user.email,
      supabaseId: row.supabaseId,
    })),
  });

  pushFinding(findings, {
    id: "broken-auth-reference",
    title: "Referencias authUserId rotas",
    message:
      "authUserId apunta a un usuario inexistente en Supabase Auth. Se sugiere reparar por email cuando sea un match único.",
    severity: "high",
    count: diagnostics.summary.brokenAuthReferencesCount,
    recoverable: true,
    suggestedActions: ["auth.repair_broken_auth_reference", "auth.deactivate_orphans"],
    sample: diagnostics.brokenAuthReferences.map((row) => ({
      userId: row.user.id,
      email: row.user.email,
      authUserId: row.user.authUserId,
      suggestedSupabaseId: row.suggestedSupabaseId,
    })),
  });

  pushFinding(findings, {
    id: "email-mismatch",
    title: "Mismatch email vs authUserId",
    message:
      "El email guardado en app difiere del email real en Supabase Auth para el mismo authUserId.",
    severity: "high",
    count: diagnostics.summary.mismatchedEmailByAuthUserIdCount,
    recoverable: true,
    suggestedActions: ["auth.repair_broken_auth_reference"],
    sample: diagnostics.mismatchedEmailByAuthUserId.map((row) => ({
      userId: row.user.id,
      appEmail: row.user.email,
      supabaseEmail: row.supabaseEmail,
      authUserId: row.user.authUserId,
    })),
  });

  pushFinding(findings, {
    id: "duplicate-supabase-emails",
    title: "Duplicados por email en Supabase Auth",
    message:
      "Hay más de una cuenta de Supabase Auth con el mismo email. Requiere revisión manual antes de autorreparar.",
    severity: "critical",
    count: diagnostics.summary.duplicateSupabaseEmailsCount,
    recoverable: false,
    suggestedActions: [],
    sample: diagnostics.duplicateSupabaseEmails.map((row) => ({
      email: row.email,
      count: row.count,
      supabaseIds: row.supabaseIds,
    })),
  });

  pushFinding(findings, {
    id: "privileged-orphans",
    title: "Huérfanos privilegiados activos",
    message:
      "Usuarios admin/owner activos sin vínculo válido a Supabase Auth. Revisión urgente.",
    severity: "critical",
    count: diagnostics.summary.privilegedOrphansCount,
    recoverable: false,
    suggestedActions: [],
    sample: diagnostics.privilegedOrphans.map((row) => ({
      userId: row.user.id,
      email: row.user.email,
      role: row.user.role,
      reason: row.reason,
    })),
  });

  const repairActions = await listRepairActionPreviews({
    diagnostics,
    previewLimit: 25,
  });

  return {
    generatedAt: new Date().toISOString(),
    requestId: params.requestId,
    diagnostics,
    findings,
    repairActions,
    summary: {
      totalFindings: findings.length,
      criticalFindings: findings.filter((finding) => finding.severity === "critical").length,
      highFindings: findings.filter((finding) => finding.severity === "high").length,
      recoverableFindings: findings.filter((finding) => finding.recoverable).length,
      safeAutoFixActions: repairActions.filter(
        (action) => action.severity === "safe_auto_fix",
      ).length,
      reviewRequiredActions: repairActions.filter(
        (action) => action.severity === "review_required",
      ).length,
    },
  };
}

export async function executeSyncRepairAction(params: {
  requestId: string;
  actionId: RepairActionId;
  actor: { id: string; email: string };
}): Promise<RepairExecutionResult> {
  const diagnostics = await getAuthSyncDiagnostics({ analysisLimit: 5000 });
  return executeRepairAction({
    actionId: params.actionId,
    actor: params.actor,
    requestId: params.requestId,
    diagnostics,
  });
}
