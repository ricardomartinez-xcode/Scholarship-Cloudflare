import { AdminPublicCtaLocation, QuoteScenarioKind } from "@prisma/client";
import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("es-MX");
const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

type DecimalLike = {
  toNumber(): number;
};

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatMoney(value: number | DecimalLike | null) {
  if (value === null) return "—";
  return currencyFormatter.format(
    typeof value === "number" ? value : value.toNumber(),
  );
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleString("es-MX") : "—";
}

function getWindowStart(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">
        {formatNumber(value)}
      </div>
      <div className="mt-1 text-sm text-slate-400">{helper}</div>
    </div>
  );
}

export default async function UnidepSimulatorAdminPage() {
  const windowStart = getWindowStart(7);

  const [
    totalSessions,
    sessionsLast7Days,
    savedScenarios,
    draftScenarios,
    quoteModeDistribution,
    simulatorCtaCount,
    simulatorAnnouncementCount,
    recentSessions,
  ] = await Promise.all([
    prisma.quoteSession.count(),
    prisma.quoteSession.count({
      where: { updatedAt: { gte: windowStart } },
    }),
    prisma.quoteScenario.count({
      where: { kind: QuoteScenarioKind.SAVED },
    }),
    prisma.quoteScenario.count({
      where: { kind: QuoteScenarioKind.DRAFT },
    }),
    prisma.quoteSession.groupBy({
      by: ["quoteMode"],
      _count: { _all: true },
      orderBy: {
        _count: { quoteMode: "desc" },
      },
    }),
    prisma.adminPublicCta.count({
      where: {
        location: {
          in: [
            AdminPublicCtaLocation.SIMULATOR_TOP,
            AdminPublicCtaLocation.SIMULATOR_BOTTOM,
          ],
        },
      },
    }),
    prisma.adminAnnouncement.count({
      where: {
        location: {
          in: [
            AdminPublicCtaLocation.SIMULATOR_TOP,
            AdminPublicCtaLocation.SIMULATOR_BOTTOM,
          ],
        },
      },
    }),
    prisma.quoteSession.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 12,
      select: {
        publicId: true,
        quoteMode: true,
        updatedAt: true,
        lastOpenedAt: true,
        scenarios: {
          orderBy: [{ updatedAt: "desc" }],
          take: 1,
          select: {
            id: true,
            label: true,
            campusNameSnapshot: true,
            programNameSnapshot: true,
            totalMxn: true,
            updatedAt: true,
            kind: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="grid gap-6 p-6">
      <section className="ui-card ui-card-pad">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
          UNIDEP
        </div>
        <h1 className="mt-1 text-xl font-semibold">Simulador</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Monitorea el módulo lateral de simulaciones en /unidep, revisa la
          actividad reciente y administra los nuevos slots
          <code className="mx-1 text-slate-100">SIMULATOR_TOP</code>
          y
          <code className="ml-1 text-slate-100">SIMULATOR_BOTTOM</code>
          para CTAs y comunicados.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/ctas"
            className="rounded-2xl border border-blue-900/40 bg-blue-950/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-blue-900/30"
          >
            Configurar CTAs
          </Link>
          <Link
            href="/admin/comunicados"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            Configurar comunicados
          </Link>
          <Link
            href="/admin/reporting"
            className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
          >
            Ir a reporting
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Sesiones"
          value={totalSessions}
          helper="Historial total del simulador"
        />
        <MetricCard
          label="Últimos 7 días"
          value={sessionsLast7Days}
          helper="Sesiones actualizadas recientemente"
        />
        <MetricCard
          label="Escenarios guardados"
          value={savedScenarios}
          helper="Snapshots marcados como SAVED"
        />
        <MetricCard
          label="Drafts"
          value={draftScenarios}
          helper="Autosaves activos por sesión"
        />
        <MetricCard
          label="CTAs del simulador"
          value={simulatorCtaCount}
          helper="Slots superior e inferior del módulo"
        />
        <MetricCard
          label="Comunicados"
          value={simulatorAnnouncementCount}
          helper="Mensajes activos para el simulador"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(320px,0.62fr)]">
        <section className="rounded-3xl border border-white/10 bg-slate-950/35 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Actividad reciente
              </div>
              <h2 className="mt-1 text-lg font-semibold">
                Sesiones más nuevas del simulador
              </h2>
            </div>
            <div className="text-sm text-slate-400">
              {formatNumber(recentSessions.length)} registros
            </div>
          </div>

          {recentSessions.length ? (
            <div className="mt-5 space-y-3">
              {recentSessions.map((session) => {
                const latestScenario = session.scenarios[0] ?? null;
                return (
                  <div
                    key={session.publicId}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-100">
                          {latestScenario?.label ?? "Escenario sin nombre"}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {session.quoteMode} · sesión {session.publicId.slice(0, 8)}
                        </div>
                      </div>
                      <div className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                        {formatMoney(latestScenario?.totalMxn ?? null)}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                      <div>
                        Programa:{" "}
                        <span className="text-slate-100">
                          {latestScenario?.programNameSnapshot ?? "N/A"}
                        </span>
                      </div>
                      <div>
                        Campus:{" "}
                        <span className="text-slate-100">
                          {latestScenario?.campusNameSnapshot ?? "N/A"}
                        </span>
                      </div>
                      <div>
                        Actualizada:{" "}
                        <span className="text-slate-100">
                          {formatDate(session.updatedAt)}
                        </span>
                      </div>
                      <div>
                        Última apertura:{" "}
                        <span className="text-slate-100">
                          {formatDate(session.lastOpenedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-400">
              Aún no hay sesiones suficientes para mostrar en este módulo.
            </div>
          )}
        </section>

        <div className="grid gap-4">
          <section className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Modos de cotización
            </div>
            <div className="mt-4 space-y-3">
              {quoteModeDistribution.length ? (
                quoteModeDistribution.map((item) => (
                  <div
                    key={item.quoteMode}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-slate-200">{item.quoteMode}</span>
                    <span className="rounded-full bg-sky-500/10 px-3 py-1 text-sky-200">
                      {formatNumber(item._count._all)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">
                  Sin actividad registrada todavía.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Rutas y APIs
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div>
                UI:
                <code className="ml-2 text-slate-100">/unidep</code>
              </div>
              <div>
                API pública:
                <code className="ml-2 text-slate-100">/api/data/simulador</code>
              </div>
              <div>
                Telemetría:
                <code className="ml-2 text-slate-100">
                  /api/data/simulador/events
                </code>
              </div>
              <div>
                Admin:
                <code className="ml-2 text-slate-100">
                  /admin/unidep/simulador
                </code>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
