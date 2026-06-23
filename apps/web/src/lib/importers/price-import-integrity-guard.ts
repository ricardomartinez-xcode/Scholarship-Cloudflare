import type { PriceOverrideSnapshot } from "@/lib/admin-config-snapshots";

import {
  inspectPriceCoverage,
  type ActivePriceCoverageInputs,
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
  if (coverage.issues.length > 0) {
    throw new PriceImportCoverageError(coverage);
  }
  return coverage;
}
