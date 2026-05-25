# Audit Remediation P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the highest-risk audit findings that can be handled safely in this branch without changing app data contracts.

**Architecture:** Keep the current Next.js App Router monorepo. Stabilize CI by making visual regression behavior explicit per platform, replace destructive Vercel schema sync with migrations, remove vulnerable SheetJS usage, and harden token/rate-limit surfaces with small focused patches.

**Tech Stack:** Next.js, Playwright, Prisma, Vercel, Vitest, ExcelJS, Chrome extension side panel.

---

### Task 1: CI Release Gate

**Files:**
- Modify: `apps/web/tests/e2e/visual-regression.spec.ts`
- Modify: `apps/web/tests/e2e/smoke.spec.ts`

- [x] Detect whether platform-specific visual snapshots exist before running visual assertions.
- [x] Keep public smoke tests required.
- [x] Skip only visual snapshots that have no baseline for the current CI platform, with an explicit console warning.
- [x] Verify with `npm run release:gate` or the narrow Playwright visual command when feasible.

### Task 2: Vercel Build Safety

**Files:**
- Modify: `scripts/vercel-build.sh`

- [x] Remove `prisma db push --accept-data-loss` from the build path.
- [x] Use `prisma migrate deploy` for schema application.
- [x] Fail build if migrations fail.
- [x] Keep `npm --workspace @relead/web run build` as the final build step.

### Task 3: Dependency Remediation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: Sheet import/export files that currently import `xlsx`.

- [x] Upgrade direct packages with available safe fixes.
- [x] Replace `xlsx` parsing/export with `exceljs`.
- [x] Remove `xlsx` from dependencies.
- [x] Run `npm audit --json` and record remaining advisories.

### Task 4: Rate Limit And Extension Token Hardening

**Files:**
- Modify: `apps/web/src/lib/rate-limit.ts`
- Modify: `apps/chrome-extension/recalc-sidepanel/*.js`
- Modify duplicate extension variants only if they are active source artifacts.

- [x] Add bounded cleanup to the in-memory limiter so stale keys cannot grow unbounded.
- [x] Remove token fallback to `window.localStorage`; keep `chrome.storage.local`.
- [x] Preserve non-sensitive UI preferences in `window.localStorage`.
- [x] Verify extension tests or static searches.

### Task 5: Verification

**Commands:**
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm audit --json`
- Browser smoke for touched UI routes if the app starts.

- [x] Run checks and document exact residual risk.
