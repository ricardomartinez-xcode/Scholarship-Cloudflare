# Price Import Coverage Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject price imports whose projected effective state leaves an active academic-offer combination without an applicable base price.

**Architecture:** Reuse the existing base-price matcher. Load published and live override layers through the active Prisma transaction, project the prepared import with pure functions, assert coverage before any write, and map the dedicated error to HTTP 422.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest, GitHub Actions, Vercel.

---

### Task 1: Transaction-capable coverage inputs and override layers

**Files:**
- Modify: `apps/web/src/lib/importers/price-coverage-report.ts`
- Modify: `apps/web/src/lib/published-price-overrides.ts`
- Test: `apps/web/src/lib/importers/__tests__/price-coverage-report.test.ts`

- [ ] Add failing tests for campus/program aliases, unresolved contexts, and deterministic issue ordering.
- [ ] Run:
  `npx vitest run -c vitest.config.ts apps/web/src/lib/importers/__tests__/price-coverage-report.test.ts`
  Expected: new assertions fail.
- [ ] Add an optional structural Prisma client to `listActivePriceCoverageInputs`.
- [ ] Expose `listPriceOverrideLayers`, `mergePriceOverrideLayers`, and optional-client support while preserving current ID-based merge semantics.
- [ ] Sort coverage issues by stable business fields.
- [ ] Re-run the focused test; expected: pass.

### Task 2: Pure effective-state projection

**Files:**
- Create: `apps/web/src/lib/importers/price-import-coverage-projection.ts`
- Create: `apps/web/src/lib/importers/__tests__/price-import-coverage-projection.test.ts`

- [ ] Write failing tests for `create`, `update`, `noop`, inactive rows, `replace`, and rejected `update-only` creates.
- [ ] Run the new test file; expected: module-not-found failure.
- [ ] Implement:

```ts
export function projectEffectivePriceOverrides(params: {
  publishedOverrides: PriceOverrideSnapshot[];
  currentLiveOverrides: PriceOverrideSnapshot[];
  rows: PriceImportCoverageRow[];
  mode: "replace" | "update-only";
}): PriceOverrideSnapshot[];
```

- [ ] Ensure `replace` substitutes only the live `base_price` layer and never mutates inputs.
- [ ] Re-run the focused test; expected: pass.

### Task 3: Coverage guard

**Files:**
- Create: `apps/web/src/lib/importers/price-import-integrity-guard.ts`
- Create: `apps/web/src/lib/importers/__tests__/price-import-integrity-guard.test.ts`

- [ ] Write failing tests for published-only coverage, live-only coverage, valid projected imports, and blocking uncovered/unresolvable offerings.
- [ ] Run the new test file; expected: module-not-found failure.
- [ ] Implement `inspectProjectedPriceImportCoverage`, `assertProjectedPriceImportCoverage`, and `PriceImportCoverageError`.
- [ ] Keep error details limited to counts and sorted `PriceCoverageIssue[]`.
- [ ] Re-run the focused test; expected: pass.

### Task 4: Integrate before transaction mutations

**Files:**
- Modify: `apps/web/src/lib/importers/prices-csv.ts`
- Modify: `apps/web/src/lib/importers/__tests__/prices-csv.test.ts`

- [ ] Add transaction tests proving:
  - rejecting `replace` performs no `deleteMany`, `create`, or `update`;
  - `update-only` with live coverage succeeds;
  - valid `replace` preserves the current summary behavior.
- [ ] Run the focused test; expected: failures because no guard is called.
- [ ] Extract one row-to-write helper and use its output for projection and persistence.
- [ ] Inside `$transaction`, load layers and active-offer contexts, assert coverage, then run existing mutations.
- [ ] Re-run the focused tests; expected: pass.

### Task 5: Add HTTP 422 contract

**Files:**
- Modify: `apps/web/src/app/api/admin/prices/import/[sessionId]/apply/route.ts`
- Create: `apps/web/src/app/api/admin/prices/import/[sessionId]/apply/route.test.ts`

- [ ] Write a failing route test where `applyPreparedPricesImport` throws `PriceImportCoverageError`.
- [ ] Assert status 422, code `PRICE_IMPORT_COVERAGE_INCOMPLETE`, structured details, and no call to `markAdminImportSessionApplied`.
- [ ] Run the route test; expected: current 500 response.
- [ ] Add the dedicated catch before generic redirect/error handling.
- [ ] Re-run the route test; expected: pass.

### Task 6: Verification and publication

**Files:**
- Modify PR description only after code validation.

- [ ] Run focused importer and route tests.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run release:gate`; on Windows, record any pre-existing win32 visual-baseline mismatch separately and rely on the Linux GitHub gate for the canonical release result.
- [ ] Confirm `git diff --check` and no changes under `prisma/**`, `.env*`, deploy config, auth, or unrelated integrations.
- [ ] Commit coherent changes, push, update PR #363, and wait for GitHub `verify` green.
- [ ] Confirm the Vercel preview is `READY`, inspect its build, health endpoint, and affected admin routes without applying production data.
