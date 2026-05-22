import { AdminCapability } from "@prisma/client";
import Link from "next/link";

import AssetHealthRunButton from "@/components/admin/AssetHealthRunButton";
import { getProductReportingSnapshot } from "@/lib/product-reporting";
import { requireAdminCapabilityUser } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

type ReportingSnapshot = Awaited<ReturnType<typeof getProductReportingSnapshot>>;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX").format(value);
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{formatNumber(value)}</div>
      <div className="mt-1 text-sm text-slate-400">{helper}</div>
    </div>
  );
}

function TopList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  emptyLabel: string;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{title}</div>
      {items.length ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <div className="text-slate-200">{item.label}</div>
              <div className="rounded-full bg-cyan-500/10 px-3 py-1 text-cyan-200">
                {formatNumber(item.count)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-400">{emptyLabel}</div>
      )}
    </section>
  );
}

export default async function ReportingPage() {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  await requireAdminCapabilityUser(AdminCapability.view_reports);
  const snapshot: ReportingSnapshot = await getProductReportingSnapshot();
  const maxDailyCount = Math.max(
    ...snapshot.simulationsByDay.map((item) => item.count),
    1,
  );
  const activeAssetAlerts =
    snapshot.assetSummary.counts.broken +
    snapshot.assetSummary.counts.timeout +
    snapshot.assetSummary.counts.unauthorized;

  return (
    <div className="grid gap-6 p-6">
      <section className="ui-card ui-card-pad">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
          Reporte operativo
        </div>
        <h1 className="mt-1 text-xl font-semibold">Producto comercial y monitoreo</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Dashboard de los últimos {snapshot.windowDays} días con simulaciones,
          escenarios guardados, CTAs, beneficios, importaciones y salud de assets.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Sesiones"
          value={snapshot.kpis.sessions}
          helper="Usuarios con historial actualizado"
        />
        <MetricCard
          label="Simulaciones"
          value={snapshot.kpis.simulations}
          helper="Eventos QUOTE_SIMULATED"
        />
        <MetricCard
          label="Escenarios guardados"
          value={snapshot.kpis.savedScenarios}
          helper="Snapshots marcados como SAVED"
        />
        <MetricCard
          label="Clicks CTA"
          value={snapshot.kpis.ctaClicks}
          helper="Interacciones registradas en el flujo"
        />
        <MetricCard
          label="Beneficios aplicados"
          value={snapshot.kpis.benefitsApplied}
          helper="Eventos BENEFIT_APPLIED"
        />
        <MetricCard
          label="Imports con alertas"
          value={snapshot.kpis.importErrors}
          helper="Warnings o errores recientes"
        />
        <MetricCard
          label="Assets con alerta"
          value={snapshot.kpis.brokenAssets}
          helper="Broken + timeout + unauthorized"
        />
        <MetricCard
          label="Sync críticos"
          value={snapshot.syncHealth.totals.criticalFindings}
          helper="Hallazgos de severidad critical"
        />
        <MetricCard
          label="Sync reparable"
          value={snapshot.syncHealth.totals.recoverableFindings}
          helper="Hallazgos con acción sugerida"
        />
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/35 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Auth sync operativo
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              Diagnóstico consolidado y auto-repair
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Último cálculo: {formatDate(snapshot.syncHealth.generatedAt)}
            </p>
          </div>
          <Link
            href="/admin/auth-sync"
            className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            Abrir módulo de sync
          </Link>
        </div>

        {!snapshot.syncHealth.neonAuthAvailable && snapshot.syncHealth.neonAuthWarning ? (
          <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {snapshot.syncHealth.neonAuthWarning}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
              Hallazgos principales
            </div>
            {snapshot.syncHealth.topFindings.length ? (
              snapshot.syncHealth.topFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <div className="text-slate-200">{finding.title}</div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        finding.severity === "critical"
                          ? "bg-red-500/15 text-red-200"
                          : finding.severity === "high"
                          ? "bg-amber-500/15 text-amber-200"
                          : finding.severity === "medium"
                          ? "bg-yellow-500/15 text-yellow-200"
                          : "bg-cyan-500/15 text-cyan-200"
                      }`}
                    >
                      {finding.severity}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-100">
                      {finding.count}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 px-3 py-2 text-sm text-emerald-100">
                Sin hallazgos críticos en el último análisis.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
              Acciones de reparación con impacto
            </div>
            {snapshot.syncHealth.repairActions.length ? (
              snapshot.syncHealth.repairActions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-slate-200">{action.name}</div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        action.severity === "safe_auto_fix"
                          ? "bg-blue-950/15 text-emerald-200"
                          : "bg-amber-500/15 text-amber-200"
                      }`}
                    >
                      {action.previewCount} impacto(s)
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{action.id}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-400">
                No hay acciones pendientes con impacto.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/35 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Simulaciones por día
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              Tendencia de los últimos 14 días
            </h2>
          </div>
          <div className="text-sm text-slate-400">
            Máximo diario: {formatNumber(maxDailyCount)}
          </div>
        </div>
        {snapshot.simulationsByDay.length ? (
          <div className="mt-5 grid gap-3">
            {snapshot.simulationsByDay.map((item) => (
              <div
                key={item.date}
                className="grid grid-cols-[120px_minmax(0,1fr)_56px] items-center gap-3"
              >
                <div className="text-sm text-slate-300">{item.date}</div>
                <div className="h-3 rounded-full bg-white/5">
                  <div
                    className="h-3 rounded-full bg-cyan-400/80"
                    style={{ width: `${Math.max((item.count / maxDailyCount) * 100, 6)}%` }}
                  />
                </div>
                <div className="text-right text-sm text-cyan-200">
                  {formatNumber(item.count)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-sm text-slate-400">
            Aún no hay simulaciones suficientes para construir la serie diaria.
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <TopList
          title="Campus más consultados"
          items={snapshot.topCampuses}
          emptyLabel="Sin campus consultados."
        />
        <TopList
          title="Programas más cotizados"
          items={snapshot.topPrograms}
          emptyLabel="Sin programas cotizados."
        />
        <TopList
          title="CTAs con más clicks"
          items={snapshot.topCtas}
          emptyLabel="Sin clicks de CTA."
        />
        <TopList
          title="Beneficios más usados"
          items={snapshot.topBenefits}
          emptyLabel="Sin beneficios aplicados."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Importaciones
              </div>
              <h2 className="mt-1 text-lg font-semibold">
                Sesiones recientes con warnings o errores
              </h2>
            </div>
            <div className="text-sm text-slate-400">
              {formatNumber(snapshot.importErrors.length)} sesiones
            </div>
          </div>

          {snapshot.importErrors.length ? (
            <div className="mt-5 space-y-3">
              {snapshot.importErrors.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-100">{item.fileName}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {item.status} · {formatDate(item.createdAt)} · campus procesados:{" "}
                        {item.campusesProcessed ?? "N/D"}
                      </div>
                    </div>
                    <div className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                      warnings {item.warnings.length} · errores {item.errors.length}
                    </div>
                  </div>
                  {item.warnings.length ? (
                    <div className="mt-3 text-sm text-amber-100">
                      Warning principal: {String(item.warnings[0])}
                    </div>
                  ) : null}
                  {item.errors.length ? (
                    <div className="mt-2 text-sm text-red-200">
                      Error principal: {String(item.errors[0])}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-400">
              No hay sesiones de importación con alertas en la ventana actual.
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <AssetHealthRunButton
            lastCheckedAt={snapshot.assetSummary.lastCheckedAt}
            alertCount={activeAssetAlerts}
          />

          <section className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Resumen de assets
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-slate-400">Healthy</div>
                <div className="mt-1 text-lg font-semibold text-emerald-300">
                  {formatNumber(snapshot.assetSummary.counts.healthy)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-slate-400">Broken</div>
                <div className="mt-1 text-lg font-semibold text-red-300">
                  {formatNumber(snapshot.assetSummary.counts.broken)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-slate-400">Timeout</div>
                <div className="mt-1 text-lg font-semibold text-amber-200">
                  {formatNumber(snapshot.assetSummary.counts.timeout)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-slate-400">Unauthorized</div>
                <div className="mt-1 text-lg font-semibold text-sky-200">
                  {formatNumber(snapshot.assetSummary.counts.unauthorized)}
                </div>
              </div>
            </div>
            {snapshot.assetSummary.brokenChecks.length ? (
              <div className="mt-4 space-y-3">
                {snapshot.assetSummary.brokenChecks.map((check) => (
                  <div
                    key={check.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="font-medium text-slate-100">{check.programName}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {check.assetType} · {check.status} · {formatDate(check.checkedAt)}
                    </div>
                    <div className="mt-2 break-all text-xs text-slate-300">{check.url}</div>
                    {check.error ? (
                      <div className="mt-2 text-xs text-red-200">{check.error}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-400">
                No hay assets en estado broken, timeout o unauthorized.
              </div>
            )}
          </section>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/35 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              CRM / webhook
            </div>
            <h2 className="mt-1 text-lg font-semibold">Propuesta definida, no activada</h2>
          </div>
          <div
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold",
              snapshot.crmProposal.enabled
                ? "bg-blue-950/20 text-emerald-200"
                : "bg-white/10 text-slate-200",
            ].join(" ")}
          >
            {snapshot.crmProposal.enabled ? "Habilitado" : "Proposal only"}
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-3 text-sm text-slate-300">
            <div>
              <span className="text-slate-400">Feature flag:</span>{" "}
              {snapshot.crmProposal.featureFlag}
            </div>
            <div>
              <span className="text-slate-400">Endpoint env:</span>{" "}
              {snapshot.crmProposal.endpointEnv}
            </div>
            <div>
              <span className="text-slate-400">Secret env:</span>{" "}
              {snapshot.crmProposal.secretEnv}
            </div>
            <div>
              <span className="text-slate-400">Retries:</span>{" "}
              {snapshot.crmProposal.retries.join(", ")}
            </div>
            <ul className="list-disc space-y-1 pl-5 text-slate-300">
              {snapshot.crmProposal.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <pre className="overflow-auto rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-slate-200">
            {JSON.stringify(snapshot.crmProposal.payload, null, 2)}
          </pre>
        </div>
      </section>
    </div>
  );
}
