import type { RuntimeMode } from "@/lib/runtime-modes";

export type QuoteHistoryInputSnapshot = {
  enrollmentType: "nuevo_ingreso" | "regreso" | "reingreso";
  businessLine: "salud" | "licenciatura" | "prepa" | "posgrado";
  modality: "presencial" | "mixta" | "online";
  plan: number;
  campus: string | null;
  average: number;
  subjectCount: number | null;
  module: string | null;
  extraChargeAmount: number;
  chargeType: string | null;
  selectedProgramId: string | null;
  selectedProgramName: string | null;
};

export type QuoteHistoryResultSnapshot = {
  source: "canonical";
  basePriceMxn: number;
  scholarshipPercent: number;
  scholarshipAmountMxn: number;
  additionalBenefitPercent: number;
  additionalBenefitNotes: string | null;
  additionalBenefitDuration: string | null;
  additionalBenefitAmountMxn: number;
  firstPaymentAmountMxn: number;
  firstPaymentNotes: string | null;
  firstPaymentDuration: string | null;
  subtotalMxn: number;
  totalMxn: number;
  tier: string | null;
  sinAccessToScholarship: boolean;
};

export type QuoteHistoryScenarioRecord = {
  id: string;
  label: string;
  kind: "DRAFT" | "SAVED";
  campusNameSnapshot: string | null;
  programNameSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
  input: QuoteHistoryInputSnapshot;
  result: QuoteHistoryResultSnapshot;
};

export type QuoteHistorySessionRecord = {
  publicId: string;
  quoteMode: RuntimeMode;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  scenarios: QuoteHistoryScenarioRecord[];
};

export type QuoteHistoryRecentSession = {
  publicId: string;
  quoteMode: RuntimeMode;
  updatedAt: string;
  latestScenarioLabel: string | null;
  latestCampusName: string | null;
  latestProgramName: string | null;
  latestTotalMxn: number | null;
};

export type QuoteHistorySavePayload = {
  mode: "autosave" | "snapshot";
  sessionPublicId?: string | null;
  label?: string | null;
  quoteMode: RuntimeMode;
  input: QuoteHistoryInputSnapshot;
  result: QuoteHistoryResultSnapshot;
};

export type QuoteHistorySaveResponse = {
  changed: boolean;
  savedScenarioId: string;
  session: QuoteHistorySessionRecord;
};

export type QuoteHistoryEventPayload = {
  type: "CTA_CLICKED" | "QUOTE_SCENARIO_LOADED" | "QUOTE_COMPARISON_VIEWED";
  sessionPublicId?: string | null;
  scenarioId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function buildQuoteHistoryFingerprint(payload: QuoteHistoryInputSnapshot) {
  return JSON.stringify({
    enrollmentType: payload.enrollmentType,
    businessLine: payload.businessLine,
    modality: payload.modality,
    plan: payload.plan,
    campus: payload.campus ?? null,
    average: Number(payload.average.toFixed(2)),
    subjectCount: payload.subjectCount ?? null,
    module: payload.module ?? null,
    extraChargeAmount: Number(payload.extraChargeAmount.toFixed(2)),
    chargeType: payload.chargeType ?? null,
    selectedProgramId: payload.selectedProgramId ?? null,
  });
}
