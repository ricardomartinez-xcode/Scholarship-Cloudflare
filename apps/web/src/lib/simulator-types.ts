import {
  buildQuoteHistoryFingerprint,
  type QuoteHistoryEventPayload,
  type QuoteHistoryInputSnapshot,
  type QuoteHistoryRecentSession,
  type QuoteHistoryResultSnapshot,
  type QuoteHistorySavePayload,
  type QuoteHistorySaveResponse,
  type QuoteHistoryScenarioRecord,
  type QuoteHistorySessionRecord,
} from "@/lib/quote-history-types";

export type SimulatorInputSnapshot = QuoteHistoryInputSnapshot;
export type SimulatorResultSnapshot = QuoteHistoryResultSnapshot;
export type SimulatorScenarioRecord = QuoteHistoryScenarioRecord;
export type SimulatorSessionRecord = QuoteHistorySessionRecord;
export type SimulatorRecentSession = QuoteHistoryRecentSession;
export type SimulatorSavePayload = QuoteHistorySavePayload;
export type SimulatorSaveResponse = QuoteHistorySaveResponse;
export type SimulatorEventPayload = QuoteHistoryEventPayload;

export const buildSimulatorFingerprint = buildQuoteHistoryFingerprint;
