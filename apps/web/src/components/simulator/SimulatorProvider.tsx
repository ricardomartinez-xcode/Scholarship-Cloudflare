"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { RuntimeMode } from "@/lib/runtime-modes";
import {
  buildSimulatorFingerprint,
  type SimulatorEventPayload,
  type SimulatorInputSnapshot,
  type SimulatorRecentSession,
  type SimulatorResultSnapshot,
  type SimulatorSaveResponse,
  type SimulatorScenarioRecord,
  type SimulatorSessionRecord,
} from "@/lib/simulator-types";

type SimulatorCalculationSnapshot = {
  input: SimulatorInputSnapshot | null;
  result: SimulatorResultSnapshot | null;
  fingerprint: string | null;
  quoteMode: RuntimeMode;
};

type SimulatorApplyHandler = (
  session: SimulatorSessionRecord,
  scenario: SimulatorScenarioRecord,
) => void;

type SimulatorContextValue = {
  currentSnapshot: SimulatorCalculationSnapshot;
  setCurrentSnapshot: (next: SimulatorCalculationSnapshot) => void;
  registerApplyScenarioHandler: (handler: SimulatorApplyHandler | null) => void;
  historySession: SimulatorSessionRecord | null;
  recentSessions: SimulatorRecentSession[];
  historyBusy: boolean;
  historyError: string | null;
  historyReady: boolean;
  snapshotLabel: string;
  setSnapshotLabel: (value: string) => void;
  compareScenarioIds: string[];
  compareScenarios: SimulatorScenarioRecord[];
  loadedScenarioFingerprint: string | null;
  loadedScenarioResult: SimulatorResultSnapshot | null;
  canSaveSnapshot: boolean;
  loadSimulatorSession: (publicId: string, scenarioId?: string | null) => Promise<void>;
  applyScenario: (
    session: SimulatorSessionRecord,
    scenario: SimulatorScenarioRecord,
  ) => void;
  toggleCompareScenario: (scenarioId: string) => void;
  handleSaveSnapshot: () => Promise<void>;
  trackEvent: (
    type: SimulatorEventPayload["type"],
    payload?: Omit<SimulatorEventPayload, "type">,
  ) => Promise<void>;
};

const SimulatorContext = createContext<SimulatorContextValue | null>(null);

const DEFAULT_SNAPSHOT: SimulatorCalculationSnapshot = {
  input: null,
  result: null,
  fingerprint: null,
  quoteMode: "canonical",
};

export function useSimulator() {
  const context = useContext(SimulatorContext);
  if (!context) {
    throw new Error("useSimulator must be used within <SimulatorProvider />");
  }
  return context;
}

export default function SimulatorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSimulatorRoute = pathname.startsWith("/unidep");
  const simulatorSessionParam =
    searchParams.get("simulador") ?? searchParams.get("quote");
  const simulatorScenarioParam =
    searchParams.get("escenario") ?? searchParams.get("scenario");

  const [currentSnapshot, setCurrentSnapshotState] =
    useState<SimulatorCalculationSnapshot>(DEFAULT_SNAPSHOT);
  const [historySession, setHistorySession] =
    useState<SimulatorSessionRecord | null>(null);
  const [recentSessions, setRecentSessions] = useState<SimulatorRecentSession[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [compareScenarioIds, setCompareScenarioIds] = useState<string[]>([]);
  const [loadedScenarioResult, setLoadedScenarioResult] =
    useState<SimulatorResultSnapshot | null>(null);
  const [loadedScenarioFingerprint, setLoadedScenarioFingerprint] =
    useState<string | null>(null);

  const loadingSessionRef = useRef(false);
  const lastAutosaveFingerprintRef = useRef<string | null>(null);
  const lastComparisonSignatureRef = useRef<string | null>(null);
  const lastHandledQueryRef = useRef<string | null>(null);
  const applyHandlerRef = useRef<SimulatorApplyHandler | null>(null);
  const pendingScenarioRef = useRef<{
    session: SimulatorSessionRecord;
    scenario: SimulatorScenarioRecord;
  } | null>(null);

  const setCurrentSnapshot = useCallback((next: SimulatorCalculationSnapshot) => {
    setCurrentSnapshotState((current) => {
      if (
        current.fingerprint === next.fingerprint &&
        current.quoteMode === next.quoteMode &&
        current.input === next.input &&
        current.result === next.result
      ) {
        return current;
      }
      return next;
    });
  }, []);

  const registerApplyScenarioHandler = useCallback(
    (handler: SimulatorApplyHandler | null) => {
      applyHandlerRef.current = handler;
      if (handler && pendingScenarioRef.current) {
        const pending = pendingScenarioRef.current;
        pendingScenarioRef.current = null;
        handler(pending.session, pending.scenario);
      }
    },
    [],
  );

  const trackEvent = useCallback(
    async (
      type: SimulatorEventPayload["type"],
      payload?: Omit<SimulatorEventPayload, "type">,
    ) => {
      const sessionPublicId =
        payload?.sessionPublicId ?? historySession?.publicId ?? null;
      if (!sessionPublicId) return;

      try {
        await fetch("/api/data/simulador/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            sessionPublicId,
            scenarioId: payload?.scenarioId ?? null,
            metadata: payload?.metadata ?? null,
          }),
        });
      } catch {
        // Ignore telemetry failures to keep the simulator responsive.
      }
    },
    [historySession?.publicId],
  );

  const syncUrl = useCallback(
    (sessionPublicId?: string | null, scenarioId?: string | null) => {
      if (!isSimulatorRoute) return;
      const params = new URLSearchParams(searchParams.toString());
      params.delete("quote");
      params.delete("scenario");
      params.delete("simulador");
      params.delete("escenario");

      if (sessionPublicId) {
        params.set("simulador", sessionPublicId);
      }
      if (scenarioId) {
        params.set("escenario", scenarioId);
      }

      lastHandledQueryRef.current = `${sessionPublicId ?? ""}:${scenarioId ?? ""}`;
      const nextQuery = params.toString();
      const targetPathname =
        pathname === "/unidep" || pathname.startsWith("/unidep/cotizador")
          ? pathname
          : "/unidep";
      router.replace(nextQuery ? `${targetPathname}?${nextQuery}` : targetPathname, {
        scroll: false,
      });
    },
    [isSimulatorRoute, pathname, router, searchParams],
  );

  const refreshRecentSessions = useCallback(async () => {
    if (!isSimulatorRoute) return;
    try {
      const response = await fetch("/api/data/simulador?limit=8", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        sessions?: SimulatorRecentSession[];
      };
      setRecentSessions(data.sessions ?? []);
    } catch {
      // Ignore recent-session refresh failures.
    }
  }, [isSimulatorRoute]);

  const applyScenario = useCallback(
    (session: SimulatorSessionRecord, scenario: SimulatorScenarioRecord) => {
      setHistorySession(session);
      setCompareScenarioIds([]);
      setHistoryError(null);
      setSnapshotLabel("");

      const fingerprint = buildSimulatorFingerprint(scenario.input);
      setLoadedScenarioFingerprint(fingerprint);
      setLoadedScenarioResult(scenario.result);
      lastAutosaveFingerprintRef.current = fingerprint;

      if (applyHandlerRef.current) {
        applyHandlerRef.current(session, scenario);
      } else {
        pendingScenarioRef.current = { session, scenario };
      }

      syncUrl(session.publicId, scenario.id);
      void trackEvent("QUOTE_SCENARIO_LOADED", {
        sessionPublicId: session.publicId,
        scenarioId: scenario.id,
      });
    },
    [syncUrl, trackEvent],
  );

  const loadSimulatorSession = useCallback(
    async (publicId: string, scenarioId?: string | null) => {
      if (!publicId || loadingSessionRef.current) return;
      loadingSessionRef.current = true;
      setHistoryBusy(true);
      setHistoryError(null);

      try {
        const response = await fetch(
          `/api/data/simulador?sessionId=${encodeURIComponent(publicId)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("No fue posible recuperar la simulación.");
        }

        const session = (await response.json()) as SimulatorSessionRecord;
        setHistorySession(session);
        const target =
          session.scenarios.find((item) => item.id === scenarioId) ??
          session.scenarios[0] ??
          null;

        if (!target) {
          throw new Error("La simulación no tiene escenarios guardados.");
        }

        applyScenario(session, target);
        void refreshRecentSessions();
      } catch (error) {
        setHistoryError(
          error instanceof Error
            ? error.message
            : "No fue posible recuperar la simulación.",
        );
      } finally {
        loadingSessionRef.current = false;
        setHistoryBusy(false);
        setHistoryReady(true);
      }
    },
    [applyScenario, refreshRecentSessions],
  );

  const compareScenarios = useMemo(() => {
    if (!historySession || compareScenarioIds.length < 2) return [];
    return compareScenarioIds
      .map(
        (scenarioId) =>
          historySession.scenarios.find((scenario) => scenario.id === scenarioId) ??
          null,
      )
      .filter(
        (scenario): scenario is SimulatorScenarioRecord => Boolean(scenario),
      );
  }, [compareScenarioIds, historySession]);

  const saveSimulatorScenario = useCallback(
    async (mode: "autosave" | "snapshot", label?: string) => {
      if (!currentSnapshot.input || !currentSnapshot.result) {
        throw new Error("Completa una simulación válida antes de guardarla.");
      }

      const response = await fetch("/api/data/simulador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          sessionPublicId: historySession?.publicId ?? null,
          label: label?.trim() ? label.trim() : null,
          quoteMode: currentSnapshot.quoteMode,
          input: currentSnapshot.input,
          result: currentSnapshot.result,
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          errorPayload?.error ?? "No fue posible guardar la simulación.",
        );
      }

      const data = (await response.json()) as SimulatorSaveResponse;
      setHistorySession(data.session);
      setRecentSessions((current) => {
        const firstScenario = data.session.scenarios[0];
        const nextItem: SimulatorRecentSession = {
          publicId: data.session.publicId,
          quoteMode: data.session.quoteMode,
          updatedAt: data.session.updatedAt,
          latestScenarioLabel: firstScenario?.label ?? null,
          latestCampusName: firstScenario?.campusNameSnapshot ?? null,
          latestProgramName: firstScenario?.programNameSnapshot ?? null,
          latestTotalMxn: firstScenario?.result.totalMxn ?? null,
        };
        return [
          nextItem,
          ...current.filter((item) => item.publicId !== nextItem.publicId),
        ].slice(0, 8);
      });

      if (mode === "snapshot") {
        syncUrl(data.session.publicId, data.savedScenarioId);
      }

      return data;
    },
    [
      currentSnapshot.input,
      currentSnapshot.quoteMode,
      currentSnapshot.result,
      historySession?.publicId,
      syncUrl,
    ],
  );

  const handleSaveSnapshot = useCallback(async () => {
    try {
      setHistoryBusy(true);
      setHistoryError(null);
      const result = await saveSimulatorScenario("snapshot", snapshotLabel);
      setSnapshotLabel("");
      const savedScenario =
        result.session.scenarios.find(
          (scenario) => scenario.id === result.savedScenarioId,
        ) ?? null;

      if (savedScenario) {
        setCompareScenarioIds([savedScenario.id]);
      }
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "No fue posible guardar la simulación.",
      );
    } finally {
      setHistoryBusy(false);
    }
  }, [saveSimulatorScenario, snapshotLabel]);

  const toggleCompareScenario = useCallback((scenarioId: string) => {
    setCompareScenarioIds((current) => {
      if (current.includes(scenarioId)) {
        return current.filter((value) => value !== scenarioId);
      }
      return [...current, scenarioId].slice(-2);
    });
  }, []);

  useEffect(() => {
    if (!isSimulatorRoute) return;
    void refreshRecentSessions();

    if (simulatorSessionParam) {
      const signature = `${simulatorSessionParam}:${simulatorScenarioParam ?? ""}`;
      if (lastHandledQueryRef.current === signature) {
        setHistoryReady(true);
        return;
      }

      lastHandledQueryRef.current = signature;
      void loadSimulatorSession(simulatorSessionParam, simulatorScenarioParam);
      return;
    }

    lastHandledQueryRef.current = null;
    const timer = window.setTimeout(() => {
      setHistoryReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    isSimulatorRoute,
    loadSimulatorSession,
    refreshRecentSessions,
    simulatorScenarioParam,
    simulatorSessionParam,
  ]);

  useEffect(() => {
    if (
      !isSimulatorRoute ||
      !historyReady ||
      !currentSnapshot.input ||
      !currentSnapshot.result ||
      !currentSnapshot.fingerprint ||
      historyBusy
    ) {
      return;
    }

    if (lastAutosaveFingerprintRef.current === currentSnapshot.fingerprint) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await saveSimulatorScenario("autosave");
          lastAutosaveFingerprintRef.current = currentSnapshot.fingerprint;
          const savedScenario =
            result.session.scenarios.find(
              (scenario) => scenario.id === result.savedScenarioId,
            ) ?? null;

          if (savedScenario) {
            setLoadedScenarioFingerprint(currentSnapshot.fingerprint);
            setLoadedScenarioResult(savedScenario.result);
          }
        } catch (error) {
          setHistoryError(
            error instanceof Error
              ? error.message
              : "No fue posible guardar la simulación.",
          );
        }
      })();
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    currentSnapshot.fingerprint,
    currentSnapshot.input,
    currentSnapshot.result,
    historyBusy,
    historyReady,
    isSimulatorRoute,
    saveSimulatorScenario,
  ]);

  useEffect(() => {
    if (compareScenarios.length !== 2 || !historySession?.publicId) {
      lastComparisonSignatureRef.current = null;
      return;
    }

    const signature = compareScenarios.map((scenario) => scenario.id).join(":");
    if (lastComparisonSignatureRef.current === signature) return;

    lastComparisonSignatureRef.current = signature;
    void trackEvent("QUOTE_COMPARISON_VIEWED", {
      scenarioId: compareScenarios[1]?.id ?? null,
      metadata: {
        comparedScenarioIds: compareScenarios.map((scenario) => scenario.id),
      },
    });
  }, [compareScenarios, historySession?.publicId, trackEvent]);

  const value = useMemo<SimulatorContextValue>(
    () => ({
      currentSnapshot,
      setCurrentSnapshot,
      registerApplyScenarioHandler,
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
      loadedScenarioResult,
      canSaveSnapshot:
        Boolean(currentSnapshot.input) &&
        Boolean(currentSnapshot.result) &&
        !historyBusy,
      loadSimulatorSession,
      applyScenario,
      toggleCompareScenario,
      handleSaveSnapshot,
      trackEvent,
    }),
    [
      applyScenario,
      compareScenarioIds,
      compareScenarios,
      currentSnapshot,
      handleSaveSnapshot,
      historyBusy,
      historyError,
      historyReady,
      historySession,
      loadSimulatorSession,
      loadedScenarioFingerprint,
      loadedScenarioResult,
      recentSessions,
      registerApplyScenarioHandler,
      setCurrentSnapshot,
      snapshotLabel,
      trackEvent,
      toggleCompareScenario,
    ],
  );

  return (
    <SimulatorContext.Provider value={value}>
      {children}
    </SimulatorContext.Provider>
  );
}
