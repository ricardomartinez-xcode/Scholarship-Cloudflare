"use client";

import { useState } from "react";

type SupabaseOnlyRow = {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string | null;
};

type AppOrphanRow = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  authUserId: string | null;
  createdAt: string;
  reason?: string;
  severity?: "critical" | "high" | "medium" | "low";
};

type SyncData = {
  ok: true;
  /** true when Supabase Auth Admin API is reachable with the server-only key. */
  supabaseAuthAvailable: boolean;
  /** Supabase Auth error detail when supabaseAuthAvailable is false. */
  supabaseAuthWarning?: string | null;
  summary: { supabaseOnlyCount: number; appOrphansCount: number };
  supabaseOnly: SupabaseOnlyRow[];
  appOrphans: AppOrphanRow[];
};

type ApiError = { ok: false; error: string };

type RepairActionId =
  | "auth.link_missing_by_email"
  | "auth.repair_broken_auth_reference"
  | "auth.deactivate_orphans"
  | "auth.create_minimal_app_users"
  | "campaigns.reset_stuck_processing"
  | "config.normalize_cta_placement";

type RepairPreviewItem = {
  key: string;
  title: string;
  details?: Record<string, unknown>;
};

type RepairPreviewAction = {
  id: RepairActionId;
  name: string;
  description: string;
  severity: "safe_auto_fix" | "review_required";
  preconditions: string[];
  module: string;
  previewCount: number;
  sample: RepairPreviewItem[];
  warnings: string[];
};

type SyncReportFinding = {
  id: string;
  title: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low";
  count: number;
  recoverable: boolean;
  suggestedActions: RepairActionId[];
  sample: Array<Record<string, unknown>>;
};

type SyncReportData = {
  ok: true;
  generatedAt: string;
  requestId: string;
  diagnostics: {
    supabaseAuthAvailable: boolean;
    supabaseAuthWarning: string | null;
    warnings: string[];
    summary: {
      supabaseOnlyCount: number;
      appOrphansCount: number;
      missingAuthUserIdMatchesCount: number;
      brokenAuthReferencesCount: number;
      mismatchedEmailByAuthUserIdCount: number;
      duplicateSupabaseEmailsCount: number;
      privilegedOrphansCount: number;
    };
  };
  findings: SyncReportFinding[];
  repairActions: RepairPreviewAction[];
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    recoverableFindings: number;
    safeAutoFixActions: number;
    reviewRequiredActions: number;
  };
};

type RepairActionResponse =
  | {
      ok: true;
      mode: "preview";
      action: RepairPreviewAction;
    }
  | {
      ok: true;
      mode: "apply";
      action: RepairPreviewAction & {
        appliedCount: number;
        skippedCount: number;
      };
    }
  | ApiError;

const fmtDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const SYSTEM_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin_operativo: "Admin Operativo",
  editor_operativo: "Editor Operativo",
  user: "Usuario",
};

export default function AuthSyncClient({ initial }: { initial: SyncData | ApiError }) {
  const [data, setData] = useState<SyncData | ApiError>(initial);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"supabaseOnly" | "appOrphans">("supabaseOnly");
  const [report, setReport] = useState<SyncReportData | ApiError | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [repairLoadingAction, setRepairLoadingAction] = useState<RepairActionId | null>(null);
  const [repairNotice, setRepairNotice] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setRepairNotice(null);
    try {
      const res = await fetch("/api/admin/auth-sync", { cache: "no-store" });
      const json = (await res.json()) as SyncData | ApiError;
      setData(json);
    } catch {
      setData({ ok: false, error: "No fue posible recargar." });
    } finally {
      setLoading(false);
    }
  }

  async function analyzeOperationalReport() {
    setReportLoading(true);
    setRepairNotice(null);
    try {
      const res = await fetch("/api/admin/sync-report?analysisLimit=2500", { cache: "no-store" });
      const json = (await res.json()) as SyncReportData | ApiError;
      setReport(json);
    } catch {
      setReport({ ok: false, error: "No fue posible generar el reporte operativo." });
    } finally {
      setReportLoading(false);
    }
  }

  async function previewRepair(actionId: RepairActionId) {
    setRepairLoadingAction(actionId);
    setRepairNotice(null);
    try {
      const res = await fetch("/api/admin/sync-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", actionId }),
      });
      const json = (await res.json()) as RepairActionResponse;
      if (!json.ok) {
        setRepairNotice(json.error);
        return;
      }
      if (json.mode !== "preview") {
        setRepairNotice("La respuesta de preview no fue válida.");
        return;
      }
      if (!report || report.ok === false) {
        await analyzeOperationalReport();
        return;
      }
      setReport({
        ...report,
        repairActions: report.repairActions.map((item) =>
          item.id === actionId ? json.action : item,
        ),
      });
      setRepairNotice(`Preview actualizado para "${json.action.name}".`);
    } catch {
      setRepairNotice("No fue posible generar el preview de la acción.");
    } finally {
      setRepairLoadingAction(null);
    }
  }

  async function applyRepair(actionId: RepairActionId) {
    const approved = window.confirm(
      "Esta acción aplicará cambios reales y registrará auditoría. ¿Deseas continuar?",
    );
    if (!approved) return;
    setRepairLoadingAction(actionId);
    setRepairNotice(null);
    try {
      const res = await fetch("/api/admin/sync-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "apply", actionId }),
      });
      const json = (await res.json()) as RepairActionResponse;
      if (!json.ok) {
        setRepairNotice(json.error);
        return;
      }
      if (json.mode !== "apply") {
        setRepairNotice("La respuesta de ejecución no fue válida.");
        return;
      }
      setRepairNotice(
        `Reparación aplicada: ${json.action.name}. ` +
          `${json.action.appliedCount} cambios, ${json.action.skippedCount} omitidos.`,
      );
      await Promise.all([reload(), analyzeOperationalReport()]);
    } catch {
      setRepairNotice("No fue posible aplicar la reparación.");
    } finally {
      setRepairLoadingAction(null);
    }
  }

  const renderSeverity = (severity: "critical" | "high" | "medium" | "low") => {
    const classes =
      severity === "critical"
        ? "border-red-500/50 bg-red-500/15 text-red-200"
        : severity === "high"
        ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
        : severity === "medium"
        ? "border-yellow-500/50 bg-yellow-500/15 text-yellow-200"
        : "border-cyan-500/40 bg-cyan-500/10 text-cyan-200";
    return (
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  return (
    <section className="ui-card ui-card-pad">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Diagnóstico
          </div>
          <h1 className="mt-1 text-lg font-semibold">Auth · Sincronización</h1>
          <p className="mt-1 text-sm text-slate-300">
            Estado de la vinculación entre{" "}
            <span className="font-mono text-xs text-slate-400">Supabase Auth</span>{" "}
            y <span className="font-mono text-xs text-slate-400">recalc_admin.user</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
        >
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      {/* Identity and domain data explanation */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/20 p-4 text-xs text-slate-400 leading-relaxed">
        <div className="font-semibold text-slate-300 mb-1">¿Qué fuentes se comparan?</div>
        <ul className="grid gap-1">
          <li>
            <span className="font-mono text-slate-300">Supabase Auth Admin API</span> —
            Fuente de identidades de <span className="font-mono">auth.users</span>.
            La app la consulta en servidor con service role y nunca expone esa clave al navegador.
          </li>
          <li>
            <span className="font-mono text-slate-300">recalc_admin.user</span> —
            Tabla de la app. Se crea al primer inicio de sesión exitoso (dominio @unidep.edu.mx o invitación válida).
            Guarda el rol global del sistema, estado activo y fecha de último acceso.
          </li>
          <li>
            <span className="font-mono text-slate-300">recalc_admin.admin_user</span> —
            <span className="text-red-400"> Eliminada.</span> Era el sistema anterior de admin con contraseñas directas,
            reemplazado por Supabase Auth y autorización de dominio en PostgreSQL/RLS.
          </li>
        </ul>
      </div>

      {data.ok === false ? (
        <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {data.error}
        </div>
      ) : (
        <>
          {/* Supabase Auth Admin API unavailable banner */}
          {!data.supabaseAuthAvailable && (
            <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm space-y-3">
              <div className="font-semibold text-amber-200">Supabase Auth Admin API no está disponible</div>

              {data.supabaseAuthWarning && (
                <p className="text-xs text-amber-300/80 font-mono leading-relaxed break-all">
                  {data.supabaseAuthWarning}
                </p>
              )}

              <div className="text-xs text-slate-300 space-y-2">
                <p className="font-semibold text-slate-200">Revisión requerida:</p>
                <p className="text-slate-400">
                  Verifica que <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> y
                  <code className="ml-1 font-mono">SUPABASE_SERVICE_ROLE_KEY</code> pertenezcan
                  al mismo proyecto y estén disponibles solo en el servidor del entorno actual.
                </p>
                <p className="text-slate-500">
                  La sección <strong className="text-slate-400">Usuarios huérfanos</strong> sigue funcionando con datos parciales
                  (solo detecta usuarios sin <code className="font-mono">authUserId</code>).
                </p>
              </div>
            </div>
          )}

          {/* Summary chips */}
          <div className="mt-5 flex flex-wrap gap-3">
            {/* Supabase-only chip */}
            <button
              type="button"
              role="tab"
              aria-selected={tab === "supabaseOnly"}
              className={`cursor-pointer rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                !data.supabaseAuthAvailable
                  ? tab === "supabaseOnly"
                    ? "border-slate-600 bg-slate-800/60 text-slate-400"
                    : "border-white/10 bg-white/5 text-slate-500 hover:bg-white/10"
                  : tab === "supabaseOnly"
                  ? data.summary.supabaseOnlyCount > 0
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                    : "border-emerald-500/50 bg-blue-950/20 text-emerald-200"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
              onClick={() => setTab("supabaseOnly")}
            >
              {!data.supabaseAuthAvailable
                ? "Supabase Auth · sin datos"
                : data.summary.supabaseOnlyCount > 0
                ? `${data.summary.supabaseOnlyCount} solo en Supabase Auth`
                : `${data.summary.supabaseOnlyCount} solo en Supabase Auth`}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tab === "appOrphans"}
              className={`cursor-pointer rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                tab === "appOrphans"
                  ? data.summary.appOrphansCount > 0
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                    : "border-emerald-500/50 bg-blue-950/20 text-emerald-200"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
              onClick={() => setTab("appOrphans")}
            >
              {data.summary.appOrphansCount > 0 ? "⚠ " : "✓ "}
              {data.summary.appOrphansCount} usuarios huérfanos
              {!data.supabaseAuthAvailable && (
                <span className="ml-1 text-xs font-normal text-slate-500">(parcial)</span>
              )}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Reporte operativo
                </div>
                <h2 className="mt-1 text-base font-semibold text-slate-100">
                  Hallazgos y auto-reparación segura
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Analiza inconsistencias con severidad y ejecuta reparaciones explícitas con auditoría.
                </p>
              </div>
              <button
                type="button"
                onClick={analyzeOperationalReport}
                disabled={reportLoading || Boolean(repairLoadingAction)}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
              >
                {reportLoading ? "Analizando..." : "Analizar"}
              </button>
            </div>

            {repairNotice ? (
              <div className="mt-3 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                {repairNotice}
              </div>
            ) : null}

            {!report ? (
              <div className="mt-3 text-sm text-slate-400">
                Ejecuta <strong>Analizar</strong> para cargar diagnóstico avanzado y acciones de reparación.
              </div>
            ) : report.ok === false ? (
              <div className="mt-3 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {report.error}
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-slate-400">Hallazgos totales</div>
                    <div className="mt-1 text-lg font-semibold text-slate-100">
                      {report.summary.totalFindings}
                    </div>
                  </div>
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                    <div className="text-xs text-red-200/90">Críticos</div>
                    <div className="mt-1 text-lg font-semibold text-red-100">
                      {report.summary.criticalFindings}
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="text-xs text-amber-200/90">Altos</div>
                    <div className="mt-1 text-lg font-semibold text-amber-100">
                      {report.summary.highFindings}
                    </div>
                  </div>
                  <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-3">
                    <div className="text-xs text-emerald-200/90">Acciones auto-fix</div>
                    <div className="mt-1 text-lg font-semibold text-emerald-100">
                      {report.summary.safeAutoFixActions}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Hallazgos
                    </div>
                    {report.findings.length ? (
                      report.findings.map((finding) => (
                        <article
                          key={finding.id}
                          className="rounded-xl border border-white/10 bg-black/20 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium text-slate-100">{finding.title}</div>
                            <div className="flex items-center gap-2">
                              {renderSeverity(finding.severity)}
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-200">
                                {finding.count}
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-slate-300">{finding.message}</p>
                          {finding.suggestedActions.length ? (
                            <p className="mt-2 text-[11px] text-slate-400">
                              Acciones sugeridas: {finding.suggestedActions.join(", ")}
                            </p>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 px-3 py-2 text-sm text-emerald-200">
                        No se detectaron hallazgos operativos.
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Repair actions
                    </div>
                    {report.repairActions.map((action) => (
                      <article
                        key={action.id}
                        className="rounded-xl border border-white/10 bg-black/20 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-slate-100">{action.name}</div>
                            <div className="mt-0.5 text-xs text-slate-400">{action.id}</div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              action.severity === "safe_auto_fix"
                                ? "bg-blue-950/15 text-emerald-200"
                                : "bg-amber-500/15 text-amber-200"
                            }`}
                          >
                            {action.severity === "safe_auto_fix" ? "Safe auto-fix" : "Review required"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-300">{action.description}</p>
                        <div className="mt-2 text-[11px] text-slate-400">
                          Impacto detectado: <strong className="text-slate-200">{action.previewCount}</strong>
                        </div>
                        {action.warnings.length ? (
                          <div className="mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
                            {action.warnings[0]}
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => previewRepair(action.id)}
                            disabled={Boolean(repairLoadingAction)}
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                          >
                            {repairLoadingAction === action.id ? "Procesando..." : "Preview"}
                          </button>
                          <button
                            type="button"
                            onClick={() => applyRepair(action.id)}
                            disabled={Boolean(repairLoadingAction) || action.previewCount === 0}
                            className="rounded-lg border border-emerald-500/40 bg-blue-950/15 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-blue-950/25 disabled:opacity-60"
                          >
                            Aplicar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {tab === "supabaseOnly" && (
            <div className="mt-4">
              {!data.supabaseAuthAvailable ? (
                /* Supabase Auth Admin API unavailable */
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 px-4 py-4 text-sm text-slate-400">
                  <p className="font-semibold text-slate-300 mb-1">
                    Esta sección no está disponible
                  </p>
                  <p>
                    Para comparar cuentas de Supabase Auth con usuarios de dominio, la service role
                    debe estar disponible exclusivamente en el servidor.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-2 text-sm text-slate-300">
                    <span className="font-semibold">Cuentas en Supabase Auth sin registro en la app.</span>{" "}
                    <span className="text-slate-400">
                      Estos usuarios pueden autenticarse en Supabase Auth pero la app los rechaza
                      (sin invitación válida, dominio no permitido, o aún no han iniciado sesión).
                      No requieren acción si fue intencional.
                    </span>
                  </div>
                  {data.supabaseOnly.length === 0 ? (
                    <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 px-4 py-3 text-sm text-emerald-200">
                      Todo sincronizado — no hay cuentas bloqueadas.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-3xl border border-white/10">
                      <table className="w-full min-w-[520px] border-collapse text-sm">
                        <thead className="bg-slate-950/40 text-slate-300">
                          <tr>
                            <th className="p-3 text-left font-semibold">Correo</th>
                            <th className="p-3 text-left font-semibold">Nombre</th>
                            <th className="p-3 text-left font-semibold">Registrado</th>
                            <th className="p-3 text-left font-semibold">Supabase Auth ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.supabaseOnly.map((row) => (
                            <tr key={row.id} className="border-t border-white/10">
                              <td className="p-3 text-slate-100">{row.email ?? "—"}</td>
                              <td className="p-3 text-slate-300">{row.name ?? "—"}</td>
                              <td className="p-3 text-slate-400">{fmtDate(row.created_at)}</td>
                              <td className="p-3 font-mono text-xs text-slate-500">{row.id}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="mt-2 text-xs text-slate-500">
                    Para dar acceso: ve a <strong>Invitaciones</strong> y envía una invitación a ese correo.
                    Para bloquear permanentemente: no se necesita acción (la app ya los bloquea).
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "appOrphans" && (
            <div className="mt-4">
              <div className="mb-2 text-sm text-slate-300">
                <span className="font-semibold">Usuarios de la app sin enlace a Supabase Auth.</span>{" "}
                <span className="text-slate-400">
                  Estos usuarios no pueden iniciar sesión hasta que su cuenta de Supabase Auth sea vinculada.
                  Ocurre si el usuario fue creado manualmente o si su identidad fue eliminada.
                  {!data.supabaseAuthAvailable && (
                    <span className="text-amber-400/70">
                      {" "}(Datos parciales: solo muestra usuarios con{" "}
                      <code className="font-mono text-xs">authUserId</code> nulo porque{" "}
                      Supabase Auth Admin API no está disponible.)
                    </span>
                  )}
                </span>
              </div>
              {data.appOrphans.length === 0 ? (
                <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 px-4 py-3 text-sm text-emerald-200">
                  {data.supabaseAuthAvailable
                    ? "Todos los usuarios de la app están correctamente enlazados."
                    : "No hay usuarios con authUserId nulo."}
                </div>
              ) : (
                  <div className="overflow-x-auto rounded-3xl border border-white/10">
                    <table className="w-full min-w-[760px] border-collapse text-sm">
                      <thead className="bg-slate-950/40 text-slate-300">
                        <tr>
                          <th className="p-3 text-left font-semibold">Correo</th>
                          <th className="p-3 text-left font-semibold">Rol</th>
                          <th className="p-3 text-left font-semibold">Activo</th>
                          <th className="p-3 text-left font-semibold">Diagnóstico</th>
                          <th className="p-3 text-left font-semibold">Auth ID</th>
                          <th className="p-3 text-left font-semibold">Creado</th>
                        </tr>
                      </thead>
                      <tbody>
                      {data.appOrphans.map((row) => (
                        <tr key={row.id} className="border-t border-white/10">
                          <td className="p-3 text-slate-100">{row.email}</td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                row.role === "owner" || row.role === "admin_operativo"
                                  ? "bg-amber-500/20 text-amber-200"
                                  : "bg-slate-700/50 text-slate-300"
                              }`}
                            >
                              {SYSTEM_ROLE_LABELS[row.role] ?? row.role}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-xs font-semibold ${
                                row.isActive ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {row.isActive ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-slate-300">
                            {row.reason ? (
                              <div className="space-y-1">
                                <div>{row.reason}</div>
                                {row.severity ? renderSeverity(row.severity) : null}
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-xs text-slate-500">
                            {row.authUserId ?? <span className="text-red-400">NULL</span>}
                          </td>
                          <td className="p-3 text-slate-400">{fmtDate(row.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2 text-xs text-slate-500">
                Para reparar: envía una nueva invitación a ese correo. Al iniciar sesión con el enlace, el sistema vinculará automáticamente la cuenta.
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
