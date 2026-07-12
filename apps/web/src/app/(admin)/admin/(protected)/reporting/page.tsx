import { AdminCapability } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";

import AdminDataTable from "@/components/admin/AdminDataTable";
import AssetHealthRunButton from "@/components/admin/AssetHealthRunButton";
import { getProductReportingSnapshot } from "@/lib/product-reporting";
import { requireAdminCapabilityUser } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

const GITHUB_REPO_URL = "https://github.com/ricardomartinez-xcode/Scholarship";

type ReportingSnapshot = Awaited<ReturnType<typeof getProductReportingSnapshot>>;
type CountItem = { label: string; count: number };

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX");
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("es-MX").format(value ?? 0);
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
    <div className="rounded-[24px] border border-[#c8d6e2] bg-white p-4 shadow-[0_12px_34px_rgb(16_32_42/0.05)]">
      <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#102838]">
        {formatNumber(value)}
      </div>
      <div className="mt-1 text-sm leading-5 text-[#536a7c]">{helper}</div>
    </div>
  );
}

function SectionCard({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-[#c8d6e2] bg-white p-5 shadow-[0_16px_50px_rgb(16_32_42/0.06)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
            {kicker}
          </div>
          <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[#102838]">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#536a7c]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "critical"
      ? "border-[#8a2d2d]/20 bg-[#fde7e7] text-[#8a2d2d]"
      : severity === "high"
        ? "border-[#7a4a00]/20 bg-[#fff3d6] text-[#7a4a00]"
        : severity === "medium"
          ? "border-[#7a4a00]/20 bg-[#fff8e6] text-[#7a4a00]"
          : "border-[#0f4c6b]/20 bg-[#0f4c6b]/10 text-[#0f4c6b]";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${tone}`}>
      {severity}
    </span>
  );
}

function TopList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: CountItem[];
  emptyLabel: string;
}) {
  return (
    <section className="rounded-[24px] border border-[#c8d6e2] bg-white p-4 shadow-[0_12px_34px_rgb(16_32_42/0.05)]">
      <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
        {title}
      </div>
      {items.length ? (
        <div className="mt-4 grid gap-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-[#d8e4ec] bg-[#f7fafc] px-3 py-2 text-sm"
            >
              <div className="min-w-0 truncate font-semibold text-[#163247]">{item.label}</div>
              <div className="rounded-full border border-[#0f4c6b]/20 bg-[#0f4c6b]/10 px-2.5 py-1 text-xs font-extrabold text-[#0f4c6b]">
                {formatNumber(item.count)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[18px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-5 text-sm text-[#536a7c]">
          {emptyLabel}
        </div>
      )}
    </section>
  );
}

function AssetStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-[#0c5f3a]"
      : tone === "warning"
        ? "text-[#7a4a00]"
        : tone === "danger"
          ? "text-[#8a2d2d]"
          : "text-[#102838]";

  return (
    <div className="rounded-[18px] border border-[#d8e4ec] bg-[#f7fafc] p-3">
      <div className="text-xs font-bold text-[#536a7c]">{label}</div>
      <div className={`mt-1 text-xl font-black ${toneClass}`}>{formatNumber(value)}</div>
    </div>
  );
}

function GithubRepairMenu() {
  const items = [
    {
      label: "Pull requests",
      description: "Revisar cambios pendientes, ramas de reparación y previews.",
      href: `${GITHUB_REPO_URL}/pulls`,
    },
    {
      label: "Nuevo issue",
      description: "Abrir un reporte técnico desde un hallazgo del autoreparador.",
      href: `${GITHUB_REPO_URL}/issues/new`,
    },
    {
      label: "Issues",
      description: "Consultar bugs, deuda técnica y seguimiento operativo.",
      href: `${GITHUB_REPO_URL}/issues`,
    },
    {
      label: "Actions",
      description: "Ver CI/CD, workflows manuales y ejecuciones recientes.",
      href: `${GITHUB_REPO_URL}/actions`,
    },
  ];

  return (
    <div className="mb-5 rounded-[22px] border border-[#c8d6e2] bg-[#f7fafc] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
            GitHub
          </div>
          <h3 className="mt-1 text-base font-black text-[#102838]">
            PRs, issues y automatizaciones
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#536a7c]">
            Accesos directos para convertir hallazgos del autoreparador en seguimiento técnico.
          </p>
        </div>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#0f4c6b] bg-white px-3 text-xs font-extrabold text-[#0f4c6b] transition hover:bg-[#0f4c6b] hover:text-white"
        >
          Abrir repo
        </a>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-[18px] border border-[#d8e4ec] bg-white px-3 py-3 text-sm transition hover:border-[#0f4c6b] hover:shadow-[0_10px_24px_rgb(16_32_42/0.08)]"
          >
            <div className="font-extrabold text-[#102838]">{item.label}</div>
            <div className="mt-1 text-xs leading-5 text-[#536a7c]">{item.description}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function DailyTrend({
  snapshot,
  maxDailyCount,
}: {
  snapshot: ReportingSnapshot;
  maxDailyCount: number;
}) {
  return (
    <SectionCard
      kicker="Simulaciones por día"
      title="Tendencia de los últimos 14 días"
      description={`Máximo diario: ${formatNumber(maxDailyCount)}`}
    >
      {snapshot.simulationsByDay.length ? (
        <div className="grid gap-3">
          {snapshot.simulationsByDay.map((item) => (
            <div
              key={item.date}
              className="grid grid-cols-[120px_minmax(0,1fr)_56px] items-center gap-3"
            >
              <div className="text-sm font-semibold text-[#536a7c]">{item.date}</div>
              <div className="h-3 rounded-full bg-[#e5edf2]">
                <div
                  className="h-3 rounded-full bg-[#0f4c6b]"
                  style={{ width: `${Math.max((item.count / maxDailyCount) * 100, 6)}%` }}
                />
              </div>
              <div className="text-right text-sm font-extrabold text-[#0f4c6b]">
                {formatNumber(item.count)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-5 text-sm text-[#536a7c]">
          Aún no hay simulaciones suficientes para construir la serie diaria.
        </div>
      )}
    </SectionCard>
  );
}

export default async function ReportingPage() {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  await requireAdminCapabilityUser(AdminCapability.view_reports);

  const snapshot: ReportingSnapshot = await getProductReportingSnapshot();
  const maxDailyCount = Math.max(...snapshot.simulationsByDay.map((item) => item.count), 1);
  const activeAssetAlerts =
    snapshot.assetSummary.counts.broken +
    snapshot.assetSummary.counts.timeout +
    snapshot.assetSummary.counts.unauthorized;

  return (
    <div className="grid gap-5 p-4 sm:p-5 lg:p-6">
      <section className="rounded-[28px] border border-[#c8d6e2] bg-white p-5 shadow-[0_18px_60px_rgb(16_32_42/0.07)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
              Reporte operativo
            </div>
            <h1 className="mt-2 max-w-4xl text-3xl font-black leading-tight tracking-[-0.055em] text-[#102838] md:text-4xl">
              Producto comercial, monitoreo y señales de operación.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#536a7c]">
              Dashboard de los últimos {snapshot.windowDays} días con simulaciones, escenarios
              guardados, CTAs, beneficios, importaciones, auth sync, salud de assets y accesos de
              reparación con GitHub.
            </p>
          </div>
          <Link
            href="/admin/auth-sync"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 text-sm font-extrabold text-white transition hover:bg-[#0b3d56]"
          >
            Abrir auth sync
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sesiones" value={snapshot.kpis.sessions} helper="Usuarios con historial actualizado" />
        <MetricCard label="Simulaciones" value={snapshot.kpis.simulations} helper="Eventos QUOTE_SIMULATED" />
        <MetricCard label="Escenarios guardados" value={snapshot.kpis.savedScenarios} helper="Snapshots marcados como SAVED" />
        <MetricCard label="Clicks CTA" value={snapshot.kpis.ctaClicks} helper="Interacciones registradas en el flujo" />
        <MetricCard label="Beneficios aplicados" value={snapshot.kpis.benefitsApplied} helper="Eventos BENEFIT_APPLIED" />
        <MetricCard label="Imports con alertas" value={snapshot.kpis.importErrors} helper="Warnings o errores recientes" />
        <MetricCard label="Assets con alerta" value={snapshot.kpis.brokenAssets} helper="Broken + timeout + unauthorized" />
        <MetricCard label="Sync críticos" value={snapshot.syncHealth.totals.criticalFindings} helper="Hallazgos de severidad crítica" />
      </section>

      <SectionCard
        kicker="Auth sync operativo"
        title="Diagnóstico consolidado y auto-repair"
        description={`Último cálculo: ${formatDate(snapshot.syncHealth.generatedAt)}`}
      >
        {!snapshot.syncHealth.supabaseAuthAvailable && snapshot.syncHealth.supabaseAuthWarning ? (
          <div className="mb-4 rounded-[18px] border border-[#7a4a00]/20 bg-[#fff3d6] px-4 py-3 text-sm font-semibold text-[#7a4a00]">
            {snapshot.syncHealth.supabaseAuthWarning}
          </div>
        ) : null}

        <GithubRepairMenu />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <div className="mb-3 text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
              Hallazgos principales
            </div>
            {snapshot.syncHealth.topFindings.length ? (
              <div className="grid gap-2">
                {snapshot.syncHealth.topFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className="flex items-center justify-between gap-3 rounded-[18px] border border-[#d8e4ec] bg-[#f7fafc] px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 truncate font-semibold text-[#163247]">
                      {finding.title}
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={finding.severity} />
                      <span className="rounded-full border border-[#c8d6e2] bg-white px-2 py-0.5 text-xs font-extrabold text-[#163247]">
                        {formatNumber(finding.count)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[18px] border border-[#0c5f3a]/20 bg-[#ddf8ea] px-4 py-3 text-sm font-semibold text-[#0c5f3a]">
                Sin hallazgos críticos en el último análisis.
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
              Acciones de reparación con impacto
            </div>
            {snapshot.syncHealth.repairActions.length ? (
              <div className="grid gap-2">
                {snapshot.syncHealth.repairActions.map((action) => (
                  <div
                    key={action.id}
                    className="rounded-[18px] border border-[#d8e4ec] bg-[#f7fafc] px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-[#163247]">{action.name}</div>
                      <SeverityBadge severity={action.severity} />
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[#536a7c]">
                      {formatNumber(action.previewCount)} impacto(s) · {action.id}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-3 text-sm text-[#536a7c]">
                No hay acciones pendientes con impacto.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <DailyTrend snapshot={snapshot} maxDailyCount={maxDailyCount} />

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <TopList title="Campus más consultados" items={snapshot.topCampus} emptyLabel="Sin campus consultados." />
        <TopList title="Programas más cotizados" items={snapshot.topPrograms} emptyLabel="Sin programas cotizados." />
        <TopList title="CTAs con más clicks" items={snapshot.topCta} emptyLabel="Sin clicks de CTA." />
        <TopList title="Beneficios más usados" items={snapshot.topBenefits} emptyLabel="Sin beneficios aplicados." />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <SectionCard
          kicker="Importaciones"
          title="Sesiones recientes con warnings o errores"
          description={`${formatNumber(snapshot.importErrors.length)} sesiones en la ventana actual.`}
        >
          <AdminDataTable maxHeight="520px">
            <table>
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Campus</th>
                  <th>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.importErrors.map((item) => (
                  <tr key={item.id}>
                    <td>{item.fileName}</td>
                    <td>{item.status}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.campusesProcessed ?? "N/D"}</td>
                    <td>
                      <div className="grid gap-1 text-xs">
                        <span className="font-semibold text-[#7a4a00]">warnings {item.warnings.length}</span>
                        <span className="font-semibold text-[#8a2d2d]">errores {item.errors.length}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!snapshot.importErrors.length ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="rounded-[18px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-6 text-sm text-[#536a7c]">
                        No hay sesiones de importación con alertas en la ventana actual.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </AdminDataTable>
        </SectionCard>

        <div className="grid gap-5 content-start">
          <AssetHealthRunButton
            lastCheckedAt={snapshot.assetSummary.lastCheckedAt}
            alertCount={activeAssetAlerts}
          />

          <SectionCard kicker="Resumen de assets" title="Estado de archivos publicados">
            <div className="grid grid-cols-2 gap-3">
              <AssetStat label="Healthy" value={snapshot.assetSummary.counts.healthy} tone="success" />
              <AssetStat label="Broken" value={snapshot.assetSummary.counts.broken} tone="danger" />
              <AssetStat label="Timeout" value={snapshot.assetSummary.counts.timeout} tone="warning" />
              <AssetStat label="Unauthorized" value={snapshot.assetSummary.counts.unauthorized} />
            </div>
          </SectionCard>
        </div>
      </section>

      <SectionCard
        kicker="Assets con alerta"
        title="Checks recientes en estado broken, timeout o unauthorized"
      >
        <AdminDataTable count={snapshot.assetSummary.brokenChecks.length} maxHeight="520px">
          <table>
            <thead>
              <tr>
                <th>Programa</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Revisado</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.assetSummary.brokenChecks.map((check) => (
                <tr key={check.id}>
                  <td>{check.programName}</td>
                  <td>{check.assetType}</td>
                  <td>{check.status}</td>
                  <td>{formatDate(check.checkedAt)}</td>
                  <td>
                    <span className="block max-w-[480px] truncate" title={check.url}>
                      {check.url}
                    </span>
                    {check.error ? (
                      <div className="mt-1 text-xs font-semibold text-[#8a2d2d]">{check.error}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!snapshot.assetSummary.brokenChecks.length ? (
                <tr>
                  <td colSpan={5}>
                    <div className="rounded-[18px] border border-dashed border-[#c8d6e2] bg-[#f7fafc] px-4 py-6 text-sm text-[#536a7c]">
                      No hay assets en estado broken, timeout o
                      unauthorized.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </AdminDataTable>
      </SectionCard>

      <SectionCard kicker="CRM / webhook" title="Propuesta definida, no activada">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid gap-3 text-sm text-[#536a7c]">
            <div>
              <span className="font-extrabold text-[#163247]">Feature flag:</span>{" "}
              {snapshot.crmProposal.featureFlag}
            </div>
            <div>
              <span className="font-extrabold text-[#163247]">Endpoint env:</span>{" "}
              {snapshot.crmProposal.endpointEnv}
            </div>
            <div>
              <span className="font-extrabold text-[#163247]">Secret env:</span>{" "}
              {snapshot.crmProposal.secretEnv}
            </div>
            <div>
              <span className="font-extrabold text-[#163247]">Retries:</span>{" "}
              {snapshot.crmProposal.retries.join(", ")}
            </div>
            <ul className="list-disc space-y-1 pl-5">
              {snapshot.crmProposal.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <pre className="max-h-[420px] overflow-auto rounded-[22px] border border-[#c8d6e2] bg-[#f7fafc] p-4 text-xs text-[#163247]">
            {JSON.stringify(snapshot.crmProposal.payload, null, 2)}
          </pre>
        </div>
      </SectionCard>
    </div>
  );
}
