import { logStructured } from "@/lib/observability";

export type ComparisonMismatch = {
  key: string;
  field: string;
  legacy: unknown;
  canonical: unknown;
  note?: string;
};

export type ComparisonSummary = {
  read: number;
  created: number;
  updated: number;
  skipped: number;
  conflicted: number;
  rejected: number;
};

export type ComparisonReport = {
  channel: string;
  mode: "compare";
  summary: ComparisonSummary;
  mismatches: ComparisonMismatch[];
  metadata?: Record<string, unknown>;
};

export function createComparisonSummary(
  partial?: Partial<ComparisonSummary>,
): ComparisonSummary {
  return {
    read: partial?.read ?? 0,
    created: partial?.created ?? 0,
    updated: partial?.updated ?? 0,
    skipped: partial?.skipped ?? 0,
    conflicted: partial?.conflicted ?? 0,
    rejected: partial?.rejected ?? 0,
  };
}

export function serializeComparisonReport(report: ComparisonReport) {
  return JSON.stringify(report);
}

export function logComparisonReport(report: ComparisonReport) {
  const base = `[canonical-compare] ${report.channel} read=${report.summary.read} mismatches=${report.mismatches.length}`;
  if (report.mismatches.length > 0) {
    logStructured("warn", base, {
      module: "canonical-compare",
      action: report.channel,
      result: "mismatch",
      metadata: {
        report,
        serialized: serializeComparisonReport(report),
      },
    });
    return;
  }
  logStructured("info", base, {
    module: "canonical-compare",
    action: report.channel,
    result: "match",
    metadata: { summary: report.summary },
  });
}
