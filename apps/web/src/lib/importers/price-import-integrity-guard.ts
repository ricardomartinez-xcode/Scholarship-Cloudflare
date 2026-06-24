import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";

import {
  inspectPriceCoverage,
  type ActivePriceCoverageInputs,
  type PriceCoverageIssue,
  type PriceCoverageReport,
} from "./price-coverage-report";
import {
  projectEffectivePriceOverrides,
  type PriceImportCoverageMode,
  type PriceImportCoverageRow,
} from "./price-import-coverage-projection";

export type PriceImportCoverageDetails = Omit<
  PriceCoverageReport,
  "generatedAt" | "cycle"
>;

export type ProjectedPriceImportCoverage = PriceImportCoverageDetails & {
  effectiveOverrides: PriceOverrideSnapshot[];
};

function priceCoverageIssueKey(issue: PriceCoverageIssue) {
  return [
    issue.kind,
    issue.offeringId,
    issue.cycle,
    issue.campus,
    issue.program,
    issue.businessLine ?? "",
    issue.modality ?? "",
    issue.plan === null ? "" : String(issue.plan),
    issue.module ?? "",
    issue.tier ?? "",
  ].join("\u0000");
}

function getCurrentCoverageIssues(params: {
  coverageInputs: ActivePriceCoverageInputs;
  publishedOverrides: PriceOverrideSnapshot[];
  currentLiveOverrides: PriceOverrideSnapshot[];
}) {
  const effectiveOverrides = projectEffectivePriceOverrides({
    publishedOverrides: params.publishedOverrides,
    currentLiveOverrides: params.currentLiveOverrides,
    rows: [],
    mode: "update-only",
  });

  return inspectPriceCoverage({
    contexts: params.coverageInputs.contexts,
    unresolvedIssues: params.coverageInputs.unresolvedIssues,
    overrides: effectiveOverrides,
  }).issues;
}

function getNewCoverageIssues(params: {
  coverageInputs: ActivePriceCoverageInputs;
  publishedOverrides: PriceOverrideSnapshot[];
  currentLiveOverrides: PriceOverrideSnapshot[];
  projectedIssues: PriceCoverageIssue[];
}) {
  const currentIssueKeys = new Set(
    getCurrentCoverageIssues(params).map(priceCoverageIssueKey),
  );

  return params.projectedIssues.filter(
    (issue) => !currentIssueKeys.has(priceCoverageIssueKey(issue)),
  );
}

export class PriceImportCoverageError extends Error {
  readonly code = "PRICE_IMPORT_COVERAGE_INCOMPLETE";
  readonly status = 422;
  readonly details: PriceImportCoverageDetails;

  constructor(coverage: ProjectedPriceImportCoverage) {
    super(
      `La importación dejaría ${coverage.issues.length} combinación(es) activa(s) sin cobertura de precio.`,
    );
    this.name = "PriceImportCoverageError";
    this.details = {
      offeringsChecked: coverage.offeringsChecked,
      combinationsChecked: coverage.combinationsChecked,
      coveredCombinations: coverage.coveredCombinations,
      issues: coverage.issues,
    };
  }
}

export function inspectProjectedPriceImportCoverage(params: {
  coverageInputs: ActivePriceCoverageInputs;
  publishedOverrides: PriceOverrideSnapshot[];
  currentLiveOverrides: PriceOverrideSnapshot[];
  rows: PriceImportCoverageRow[];
  mode: PriceImportCoverageMode;
}): ProjectedPriceImportCoverage {
  const effectiveOverrides = projectEffectivePriceOverrides({
    publishedOverrides: params.publishedOverrides,
    currentLiveOverrides: params.currentLiveOverrides,
    rows: params.rows,
    mode: params.mode,
  });

  return {
    ...inspectPriceCoverage({
      contexts: params.coverageInputs.contexts,
      unresolvedIssues: params.coverageInputs.unresolvedIssues,
      overrides: effectiveOverrides,
    }),
    effectiveOverrides,
  };
}

export function assertProjectedPriceImportCoverage(
  params: Parameters<typeof inspectProjectedPriceImportCoverage>[0],
) {
  const coverage = inspectProjectedPriceImportCoverage(params);
  const newIssues = getNewCoverageIssues({
    coverageInputs: params.coverageInputs,
    publishedOverrides: params.publishedOverrides,
    currentLiveOverrides: params.currentLiveOverrides,
    projectedIssues: coverage.issues,
  });

  if (newIssues.length > 0) {
    throw new PriceImportCoverageError({
      ...coverage,
      issues: newIssues,
    });
  }
  return coverage;
}
