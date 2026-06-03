# Admin Control API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated `/api/admin` control endpoints for academic offer imports, quote diagnostics, admin config, system status, users, audit log, and GitHub.

**Architecture:** Reuse existing Next.js App Router routes, `requireAdminApiCapability`, `adminApiSuccess/adminApiError`, Prisma models, audit log, academic-offer importer, and quote engine. Keep all writes scoped to existing tables and avoid schema/auth/deploy changes.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest, existing admin auth, GitHub REST API via `fetch`.

---

### Task 1: Shared Helpers And Tests

**Files:**
- Create: `apps/web/src/lib/admin-control-api.ts`
- Test: `apps/web/src/lib/__tests__/admin-control-api.test.ts`

- [ ] Write tests for safe pagination, CSV/row cycle detection, safe env checks, and JSON row validation.
- [ ] Run targeted test and verify it fails because the helper does not exist.
- [ ] Implement minimal shared helpers.
- [ ] Re-run targeted test and verify it passes.

### Task 2: Academic Offer Control

**Files:**
- Create: `apps/web/src/lib/admin-academic-offer-control.ts`
- Create: `apps/web/src/app/api/admin/import/academic-offer/validate/route.ts`
- Create: `apps/web/src/app/api/admin/import/academic-offer/route.ts`
- Create: `apps/web/src/app/api/admin/academic-offers/route.ts`
- Create: `apps/web/src/app/api/admin/academic-offers/[id]/status/route.ts`
- Test: `apps/web/src/lib/__tests__/admin-academic-offer-control.test.ts`

- [ ] Test normalized JSON rows reject bad cycles/plans/modules and infer `C1/C2/C3`.
- [ ] Implement request parsing for form-data CSV/XLSX and JSON `{ cycle, csv, rows, dryRun }`.
- [ ] Use `prepareAcademicOfferImport` for validation/dry-run and `importAcademicOfferFromExcel` for safe upsert apply.
- [ ] List/filter/paginate `ProgramOffering` and PATCH status without deletion.

### Task 3: Quote Control

**Files:**
- Create: `apps/web/src/lib/admin-quote-control.ts`
- Create: `apps/web/src/app/api/admin/quotes/simulate/route.ts`
- Create: `apps/web/src/app/api/admin/quotes/diagnose/route.ts`
- Test: `apps/web/src/lib/__tests__/admin-quote-control.test.ts`

- [ ] Test missing-field diagnostics and non-secret response shape.
- [ ] Reuse normalizers, `resolveQuoteAcademicOffering`, and `resolveCanonicalQuote`.
- [ ] Return controlled diagnostics for missing campus, offering, plan/module, rules, and base price.

### Task 4: Administrative And System Control

**Files:**
- Create: `apps/web/src/app/api/admin/audit-log/route.ts`
- Create: `apps/web/src/app/api/admin/config/route.ts`
- Create: `apps/web/src/app/api/admin/users/route.ts`
- Create: `apps/web/src/app/api/admin/users/[id]/role/route.ts`
- Create: `apps/web/src/lib/admin-system-control.ts`
- Create: `apps/web/src/app/api/admin/system/health/route.ts`
- Create: `apps/web/src/app/api/admin/system/status/route.ts`
- Create: `apps/web/src/app/api/admin/system/env-check/route.ts`
- Create: `apps/web/src/app/api/admin/system/importer-status/route.ts`
- Create: `apps/web/src/app/api/admin/system/quote-engine-status/route.ts`

- [ ] Implement audit log filters and pagination.
- [ ] Implement safe config get/patch using existing `AdminSidebarInfo` keys.
- [ ] Implement user listing and role update with last-owner guard.
- [ ] Implement system probes without exposing env values.

### Task 5: GitHub Control

**Files:**
- Create: `apps/web/src/lib/admin-github-control.ts`
- Create: `apps/web/src/app/api/admin/github/repository/route.ts`
- Create: `apps/web/src/app/api/admin/github/pulls/route.ts`
- Create: `apps/web/src/app/api/admin/github/actions/runs/route.ts`
- Create: `apps/web/src/app/api/admin/github/issues/route.ts`
- Create: `apps/web/src/app/api/admin/github/actions/dispatch/route.ts`
- Create: `apps/web/src/app/api/admin/github/commits/latest/route.ts`

- [ ] Implement safe GitHub env validation.
- [ ] Handle 401, 403, 404, and rate-limit responses without exposing tokens.
- [ ] Audit write actions: issue creation and workflow dispatch.

### Task 6: Verification And Deployment

- [ ] Run targeted Vitest files.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit, push to origin, and verify Vercel deployment becomes `READY`.
