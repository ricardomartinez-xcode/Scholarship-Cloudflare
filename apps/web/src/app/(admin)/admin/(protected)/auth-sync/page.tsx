import { AdminCapability } from "@prisma/client";

import AuthSyncClient from "@/components/admin/AuthSyncClient";
import { requireAdminApiCapability } from "@/lib/api-auth";
import { getAuthSyncDiagnostics } from "@/services/authSyncService";

export const dynamic = "force-dynamic";

type SyncInitial =
  | { ok: false; error: string }
  | {
      ok: true;
      supabaseAuthAvailable: boolean;
      supabaseAuthWarning?: string | null;
      summary: { supabaseOnlyCount: number; appOrphansCount: number };
      supabaseOnly: Array<{
        id: string;
        email: string | null;
        name: string | null;
        created_at: string | null;
      }>;
      appOrphans: Array<{
        id: string;
        email: string;
        role: string;
        isActive: boolean;
        authUserId: string | null;
        createdAt: string;
        reason: string;
        severity: "critical" | "high" | "medium" | "low";
      }>;
    };

async function requireReportingAccess() {
  const operationsAuth = await requireAdminApiCapability(
    "ssr_auth_sync",
    AdminCapability.view_admin_operations,
  );
  if (!operationsAuth.ok) return false;
  const reportsAuth = await requireAdminApiCapability(
    "ssr_auth_sync",
    AdminCapability.view_reports,
  );
  if (!reportsAuth.ok) return false;
  return true;
}

async function loadSyncData(): Promise<SyncInitial> {
  const access = await requireReportingAccess();
  if (!access) {
    return { ok: false, error: "Sesión expirada o permisos insuficientes." };
  }

  const diagnostics = await getAuthSyncDiagnostics({ analysisLimit: 2500 });

  return {
    ok: true,
    supabaseAuthAvailable: diagnostics.supabaseAuthAvailable,
    supabaseAuthWarning: diagnostics.supabaseAuthWarning,
    summary: {
      supabaseOnlyCount: diagnostics.summary.supabaseOnlyCount,
      appOrphansCount: diagnostics.summary.appOrphansCount,
    },
    supabaseOnly: diagnostics.supabaseOnly.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      created_at: row.createdAt,
    })),
    appOrphans: diagnostics.appOrphans.map((record) => ({
      id: record.user.id,
      email: record.user.email,
      role: record.user.role,
      isActive: record.user.isActive,
      authUserId: record.user.authUserId,
      createdAt: record.user.createdAt,
      reason: record.reason,
      severity: record.severity,
    })),
  };
}

export default async function AuthSyncPage() {
  let initial: SyncInitial;
  try {
    initial = await loadSyncData();
  } catch (error) {
    initial = {
      ok: false,
      error:
        "No fue posible cargar el diagnóstico de sincronización. " +
        (error instanceof Error ? error.message : String(error)),
    };
  }
  return <AuthSyncClient initial={initial} />;
}
