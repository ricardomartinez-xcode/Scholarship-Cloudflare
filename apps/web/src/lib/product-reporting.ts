import { BusinessEventType, QuoteScenarioKind } from "@prisma/client";

import { getProgramAssetHealthSummary } from "@/lib/asset-health";
import { prisma } from "@/lib/prisma";
import { generateSyncOperationalReport } from "@/services/syncReportService";

const REPORTING_WINDOW_DAYS = 30;
const DAILY_WINDOW_DAYS = 14;

function startOfDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function getRecentDate(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return value;
}

function getMetadataString(
  metadata: unknown,
  key: string,
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function accumulateCounter(
  target: Map<string, number>,
  key: string | null,
  amount = 1,
) {
  if (!key) return;
  target.set(key, (target.get(key) ?? 0) + amount);
}

function topEntries(map: Map<string, number>, limit = 5) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "es"))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function getCrmWebhookProposal() {
  const enabled = process.env.PROPOSAL_WEBHOOK_ENABLED === "true";
  return {
    enabled,
    featureFlag: "PROPOSAL_WEBHOOK_ENABLED",
    endpointEnv: "PROPOSAL_WEBHOOK_URL",
    secretEnv: "PROPOSAL_WEBHOOK_SECRET",
    retries: ["retry_1m", "retry_5m", "retry_30m", "retry_2h"],
    payload: {
      event: "quote.simulated",
      sessionId: "q_abc123",
      scenarioId: "scenario_uuid",
      userId: "internal-user-uuid",
      timestamp: "2026-03-08T02:20:00.000Z",
      quoteMode: "canonical",
      input: {
        enrollmentType: "nuevo_ingreso",
        businessLine: "licenciatura",
        modality: "mixta",
        plan: 8,
        campus: "HERMOSILLO",
        average: 8.7,
      },
      result: {
        scholarshipPercent: 45,
        additionalBenefitPercent: 10,
        totalMxn: 3450,
      },
    },
    notes: [
      "No se envían tokens ni secretos en el payload.",
      "La activación debe depender del feature flag y de un secreto HMAC.",
      "Si el webhook falla, solo se reintenta; no bloquea la simulación.",
    ],
  };
}

export async function getProductReportingSnapshot() {
  const since = getRecentDate(REPORTING_WINDOW_DAYS);
  const dailySince = getRecentDate(DAILY_WINDOW_DAYS);
  const syncReportPromise = generateSyncOperationalReport({
    requestId: `reporting_snapshot_${Date.now().toString(36)}`,
    analysisLimit: 1500,
  }).catch(() => null);

  const [
    simulationEvents,
    ctaEvents,
    benefitEvents,
    savedScenarioCount,
    sessionCount,
    importSessions,
    assetSummary,
    syncReport,
  ] = await Promise.all([
    prisma.businessEvent.findMany({
      where: {
        type: BusinessEventType.QUOTE_SIMULATED,
        createdAt: { gte: since },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 1500,
      select: {
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.businessEvent.findMany({
      where: {
        type: BusinessEventType.CTA_CLICKED,
        createdAt: { gte: since },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 1500,
      select: {
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.businessEvent.findMany({
      where: {
        type: BusinessEventType.BENEFIT_APPLIED,
        createdAt: { gte: since },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 1500,
      select: {
        metadata: true,
      },
    }),
    prisma.quoteScenario.count({
      where: {
        kind: QuoteScenarioKind.SAVED,
        createdAt: { gte: since },
      },
    }),
    prisma.quoteSession.count({
      where: { updatedAt: { gte: since } },
    }),
    prisma.adminImportSession.findMany({
      where: {
        createdAt: { gte: since },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        module: true,
        status: true,
        fileName: true,
        warnings: true,
        errors: true,
        summary: true,
        createdAt: true,
      },
    }),
    getProgramAssetHealthSummary(),
    syncReportPromise,
  ]);

  const simulationsByDay = new Map<string, number>();
  const campuses = new Map<string, number>();
  const programs = new Map<string, number>();
  const ctas = new Map<string, number>();
  const benefits = new Map<string, number>();

  for (const event of simulationEvents) {
    if (event.createdAt >= dailySince) {
      const dayKey = startOfDay(event.createdAt).toISOString().slice(0, 10);
      accumulateCounter(simulationsByDay, dayKey);
    }
    accumulateCounter(campuses, getMetadataString(event.metadata, "campus"));
    accumulateCounter(programs, getMetadataString(event.metadata, "program"));
  }

  for (const event of ctaEvents) {
    const label = getMetadataString(event.metadata, "label");
    const placement = getMetadataString(event.metadata, "placement");
    const key = [label, placement].filter(Boolean).join(" · ");
    accumulateCounter(ctas, key || label);
  }

  for (const event of benefitEvents) {
    const notes = getMetadataString(event.metadata, "additionalBenefitNotes");
    const businessLine = getMetadataString(event.metadata, "businessLine");
    const key = notes ? `${notes} · ${businessLine ?? "sin línea"}` : businessLine;
    accumulateCounter(benefits, key);
  }

  const importErrors = importSessions
    .map((session) => {
      const warnings = Array.isArray(session.warnings) ? session.warnings : [];
      const errors = Array.isArray(session.errors) ? session.errors : [];
      const summary =
        session.summary && typeof session.summary === "object"
          ? (session.summary as Record<string, unknown>)
          : null;
      const campusesProcessed =
        summary && typeof summary.campusesProcessed === "number"
          ? summary.campusesProcessed
          : null;
      return {
        id: session.id,
        fileName: session.fileName ?? "archivo",
        status: session.status,
        warnings,
        errors,
        campusesProcessed,
        createdAt: session.createdAt.toISOString(),
      };
    })
    .filter((session) => session.status === "failed" || session.errors.length || session.warnings.length);

  return {
    windowDays: REPORTING_WINDOW_DAYS,
    kpis: {
      sessions: sessionCount,
      simulations: simulationEvents.length,
      savedScenarios: savedScenarioCount,
      ctaClicks: ctaEvents.length,
      benefitsApplied: benefitEvents.length,
      importErrors: importErrors.length,
      brokenAssets:
        assetSummary.counts.broken +
        assetSummary.counts.timeout +
        assetSummary.counts.unauthorized,
    },
    simulationsByDay: [...simulationsByDay.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, count]) => ({ date, count })),
    topCampus: topEntries(campuses),
    topCampuses: topEntries(campuses),
    topPrograms: topEntries(programs),
    topCtas: topEntries(ctas),
    topBenefits: topEntries(benefits),
    importErrors,
    assetSummary,
    crmProposal: getCrmWebhookProposal(),
    syncHealth: {
      generatedAt: syncReport?.generatedAt ?? new Date().toISOString(),
      neonAuthAvailable: syncReport?.diagnostics.neonAuthAvailable ?? false,
      neonAuthWarning:
        syncReport?.diagnostics.neonAuthWarning ??
        "No se pudo construir el diagnóstico de sincronización para este snapshot.",
      totals: syncReport?.summary ?? {
        totalFindings: 0,
        criticalFindings: 0,
        highFindings: 0,
        recoverableFindings: 0,
        safeAutoFixActions: 0,
        reviewRequiredActions: 0,
      },
      topFindings:
        syncReport?.findings.slice(0, 5).map((finding) => ({
          id: finding.id,
          title: finding.title,
          severity: finding.severity,
          count: finding.count,
        })) ?? [],
      repairActions:
        syncReport?.repairActions.slice(0, 5).map((action) => ({
          id: action.id,
          name: action.name,
          severity: action.severity,
          previewCount: action.previewCount,
        })) ?? [],
    },
  };
}
