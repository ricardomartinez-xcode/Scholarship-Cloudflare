"use client";

import { useState } from "react";

import AnnouncementOutlet, {
  type Announcement,
} from "@/components/announcement/AnnouncementOutlet";
import ConfiguredCtaList from "@/components/cta/ConfiguredCtaList";
import { useSimulator } from "@/components/simulator/SimulatorProvider";
import { buildSimulatorFingerprint } from "@/lib/simulator-types";

type PublicCta = {
  id: string;
  label: string;
  kind: "link" | "action";
  url: string | null;
  variant: string | null;
  placement?: string | null;
};

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

function formatMoney(value: number) {
  return currency.format(Math.round(value * 100) / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function trackConfiguredCtaClick(
  trackEvent: ReturnType<typeof useSimulator>["trackEvent"],
  cta: PublicCta,
) {
  return trackEvent("CTA_CLICKED", {
    metadata: {
      placement: cta.placement,
      kind: cta.kind,
      label: cta.label,
      url: cta.url,
    },
  });
}

export default function SimulatorSidebarPanel({
  activeSection,
  onSelectSection,
  topCtas = [],
  bottomCtas = [],
  topAnnouncements = [],
  bottomAnnouncements = [],
  collapsible = false,
  defaultOpen = true,
  open,
  onOpenChange,
}: {
  activeSection: string;
  onSelectSection: (key: string) => void;
  topCtas?: PublicCta[];
  bottomCtas?: PublicCta[];
  topAnnouncements?: Announcement[];
  bottomAnnouncements?: Announcement[];
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const {
    currentSnapshot,
    historySession,
    recentSessions,
    historyBusy,
    historyError,
    historyReady,
    snapshotLabel,
    setSnapshotLabel,
    compareScenarioIds,
    compareScenarios,
    loadedScenarioFingerprint,
    canSaveSnapshot,
    loadSimulatorSession,
    applyScenario,
    toggleCompareScenario,
    handleSaveSnapshot,
    trackEvent,
  } = useSimulator();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = typeof open === "boolean" ? open : internalOpen;

  const setPanelOpen = (nextOpen: boolean) => {
    if (typeof open !== "boolean") {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const ensureCalculatorSection = () => {
    if (activeSection !== "becas") {
      onSelectSection("becas");
    }
  };

  const compactSummary = historySession
    ? `${historySession.scenarios.length} escenario(s) en sesión · ${recentSessions.length} simulación(es) recientes`
    : recentSessions.length
      ? `${recentSessions.length} simulación(es) recientes`
      : "Sin historial.";

  return (
    <section className="ui-card min-w-0 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="ui-kicker">Historial</div>
          <h2 className="mt-1 text-base font-semibold leading-tight text-slate-100">
            Historial de escenarios
          </h2>
        </div>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setPanelOpen(!isOpen)}
            className="ui-cta-secondary min-w-[104px] self-start whitespace-nowrap px-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-200 sm:self-auto"
          >
            {isOpen ? "Ocultar" : "Abrir"}
          </button>
        ) : null}
      </div>

      {historySession ? (
        <div className="mt-3 rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-2 text-xs text-slate-300">
          <div className="font-medium text-slate-100">
            Sesión {historySession.publicId.slice(0, 8)}
          </div>
          <div className="mt-1">
            Actualizada: {formatDate(historySession.updatedAt)}
          </div>
        </div>
      ) : null}

      {collapsible && !isOpen ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-3 text-sm text-slate-300">
          {compactSummary}
        </div>
      ) : (
        <>
          <AnnouncementOutlet
            announcements={topAnnouncements}
            className="mt-4 grid gap-2"
          />
          {topCtas.length ? (
            <ConfiguredCtaList
              ctas={topCtas}
              className="mt-4 grid gap-2"
              itemClassName="text-left"
              onCtaClick={(cta) => void trackConfiguredCtaClick(trackEvent, cta)}
            />
          ) : null}

          {historyError ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
              {historyError}
            </div>
          ) : null}

          {!historyReady || historyBusy ? (
            <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/35 p-3 text-sm text-slate-300">
              Cargando simulador...
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Simulaciones recientes
              </div>
              {recentSessions.length ? (
                <div className="mt-3 space-y-2">
                  {recentSessions.map((session) => (
                    <button
                      key={session.publicId}
                      type="button"
                      disabled={historyBusy}
                      className="w-full rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-3 text-left transition hover:border-cyan-400/30 hover:bg-cyan-500/6 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        ensureCalculatorSection();
                        void loadSimulatorSession(session.publicId);
                      }}
                    >
                      <div className="font-medium text-slate-100">
                        {session.latestScenarioLabel ?? "Escenario sin nombre"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {session.latestCampusName ?? "Sin campus"} ·{" "}
                        {session.latestProgramName ?? "Sin programa"}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-400">{session.quoteMode}</span>
                        <span className="text-cyan-200">
                          {typeof session.latestTotalMxn === "number"
                            ? formatMoney(session.latestTotalMxn)
                            : "Sin monto guardado"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDate(session.updatedAt)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">
                  Sin simulaciones recientes.
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Guardar escenario
              </div>
              <div className="mt-3 grid gap-3">
                <input
                  value={snapshotLabel}
                  onChange={(event) => setSnapshotLabel(event.target.value)}
                  className="ui-control"
                  placeholder="Ej. Prepa online 20%"
                  maxLength={120}
                />
                <button
                  type="button"
                  className="ui-cta-primary justify-center rounded-2xl px-4 text-sm text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void handleSaveSnapshot()}
                  disabled={!canSaveSnapshot}
                >
                  Guardar escenario
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Escenarios de la sesión
              </div>
              {historySession?.scenarios.length ? (
                <div className="mt-3 space-y-2">
                  {historySession.scenarios.map((scenario) => {
                    const isSelected = compareScenarioIds.includes(scenario.id);
                    const isStaleLoadedScenario = Boolean(
                      loadedScenarioFingerprint &&
                        currentSnapshot.fingerprint &&
                        currentSnapshot.fingerprint !== loadedScenarioFingerprint,
                    );
                    const isLoaded =
                      !isStaleLoadedScenario &&
                      loadedScenarioFingerprint ===
                        buildSimulatorFingerprint(scenario.input);

                    return (
                      <div
                        key={scenario.id}
                        className="rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-100">
                              {scenario.label}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {scenario.programNameSnapshot ?? "Sin programa"} ·{" "}
                              {scenario.campusNameSnapshot ?? "Sin campus"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatDate(scenario.updatedAt)}
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="text-slate-400">{scenario.result.source}</div>
                            <div className="mt-1 text-cyan-200">
                              {formatMoney(scenario.result.totalMxn)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-white/8 px-3 py-1 text-xs text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
                            onClick={() => {
                              ensureCalculatorSection();
                              applyScenario(historySession, scenario);
                            }}
                          >
                            {isLoaded ? "Escenario activo" : "Cargar escenario"}
                          </button>
                          <button
                            type="button"
                            className={[
                              "rounded-full border px-3 py-1 text-xs transition",
                              isSelected
                                ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-200"
                                : "border-white/10 text-slate-200 hover:border-cyan-400/40 hover:text-cyan-200",
                            ].join(" ")}
                            onClick={() => toggleCompareScenario(scenario.id)}
                          >
                            {isSelected ? "Quitar comparación" : "Comparar"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">
                  Sin escenarios guardados.
                </div>
              )}
            </div>

            {compareScenarioIds.length === 1 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                Selecciona un escenario más para comparar.
              </div>
            ) : null}

            {compareScenarios.length === 2 ? (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                  Comparación rápida
                </div>
                <div className="mt-3 grid gap-2">
                  {compareScenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-3"
                    >
                      <div className="font-medium text-slate-100">{scenario.label}</div>
                      <div className="mt-2 space-y-1 text-xs text-slate-300">
                        <div>
                          Campus:{" "}
                          <span className="text-slate-100">
                            {scenario.campusNameSnapshot ??
                              scenario.input.campus ??
                              "N/A"}
                          </span>
                        </div>
                        <div>
                          Modalidad:{" "}
                          <span className="text-slate-100">
                            {scenario.input.modality}
                          </span>
                        </div>
                        <div>
                          Beca:{" "}
                          <span className="text-slate-100">
                            {scenario.result.sinAccessToScholarship
                              ? "Sin acceso"
                              : `${scenario.result.scholarshipPercent}%`}
                          </span>
                        </div>
                        <div>
                          Beneficio extra:{" "}
                          <span className="text-slate-100">
                            {scenario.result.additionalBenefitPercent
                              ? `${scenario.result.additionalBenefitPercent}%`
                              : "Sin beneficio"}
                          </span>
                        </div>
                        <div className="pt-2 text-sm font-semibold text-cyan-200">
                          {formatMoney(scenario.result.totalMxn)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {bottomCtas.length ? (
            <ConfiguredCtaList
              ctas={bottomCtas}
              className="mt-4 grid gap-2"
              itemClassName="text-left"
              onCtaClick={(cta) => void trackConfiguredCtaClick(trackEvent, cta)}
            />
          ) : null}
          <AnnouncementOutlet
            announcements={bottomAnnouncements}
            className="mt-4 grid gap-2"
          />
        </>
      )}
    </section>
  );
}
