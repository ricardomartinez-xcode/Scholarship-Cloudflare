# Vercel Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `apps/web` from the Cloudflare Workers/OpenNext/D1/R2 path into a standard Next.js application deployable on Vercel with Supabase PostgreSQL, Supabase Auth, Supabase Realtime and Supabase Storage.

**Architecture:** Keep the monorepo, App Router UI, domain logic and existing permission model. Make `supabase/migrations` the forward schema source, add shared Supabase clients and adapters, and isolate Cloudflare files under `legacy/cloudflare` so production Cloudflare remains untouched.

**Tech Stack:** Next.js 16, React 19, npm workspaces, Prisma as temporary generated client where needed, Supabase PostgreSQL/Auth/Realtime/Storage, Vercel Preview Deployments, Vitest, Playwright.

---

## Guardrails

- Do not deploy Cloudflare or Vercel production.
- Do not run remote destructive migrations.
- Do not read, print or commit real `.env*` secrets.
- Use Supabase staging for remote validation only when credentials exist.
- Keep commits small and reversible.
- Treat `apps/web/src/app/api/public/campaigns/optional-sender/route.ts` as a preexisting blocker from baseline.

## Task 1: Fix Baseline Typecheck Blocker

**Files:**
- Modify: `apps/web/src/app/api/public/campaigns/optional-sender/route.ts`

- [ ] **Step 1: Verify current failure**

Run:

```bash
npm run typecheck
```

Expected: fails with `createCampagn`/`createCampaign` mismatch.

- [ ] **Step 2: Apply minimal fix**

Change the import to use `createCampaign` from `@/lib/public-campaign-sender`.

- [ ] **Step 3: Verify focused checks**

Run:

```bash
npm run lint
npm run typecheck
```

Expected: the `optional-sender` typo no longer appears.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/public/campaigns/optional-sender/route.ts
git commit -m "fix: repair optional sender campaign import"
```

## Task 2: Make Next.js The Default Build Path

**Files:**
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/web/next.config.ts`
- Move: `apps/web/open-next.config.ts` to `legacy/cloudflare/apps-web/open-next.config.ts`
- Move: `apps/web/wrangler.jsonc` to `legacy/cloudflare/apps-web/wrangler.jsonc`
- Move: `apps/web/scripts/build-cloudflare.mjs` to `legacy/cloudflare/apps-web/scripts/build-cloudflare.mjs`
- Move: `apps/web/scripts/prepare-cloudflare-deploy.mjs` to `legacy/cloudflare/apps-web/scripts/prepare-cloudflare-deploy.mjs`
- Move: `apps/web/scripts/deploy-prepared-cloudflare.mjs` to `legacy/cloudflare/apps-web/scripts/deploy-prepared-cloudflare.mjs`

- [ ] **Step 1: Update scripts**

Make root `build` run `npm --workspace @relead/web run build`. Keep legacy Cloudflare commands only as `legacy:cloudflare:*` root scripts that point to documentation or moved files, not the default build.

- [ ] **Step 2: Simplify Next config**

Remove `CLOUDFLARE_BUILD`, OpenNext aliases and R2 hostname logic from `apps/web/next.config.ts`. Keep `outputFileTracingRoot`, `transpilePackages`, import aliases and Sentry wrapping.

- [ ] **Step 3: Preserve rollback assets**

Move Cloudflare config/scripts into `legacy/cloudflare/apps-web/` and add `legacy/cloudflare/README.md` explaining that these files are historical rollback references only.

- [ ] **Step 4: Verify**

Run:

```bash
npm run typecheck
npm run build
```

Expected: `npm run build` uses `next build --webpack`, not OpenNext or Wrangler. If build still exits 137, document and reduce build memory pressure in the next step.

- [ ] **Step 5: Commit**

```bash
git add package.json apps/web/package.json apps/web/next.config.ts legacy/cloudflare package-lock.json
git commit -m "refactor: remove opennext and wrangler build path"
```

## Task 3: Add Typed Environment Validation

**Files:**
- Create: `.env.example`
- Create: `apps/web/.env.example`
- Create: `apps/web/src/lib/env/server.ts`
- Create: `apps/web/src/lib/env/client.ts`
- Test: `apps/web/src/lib/env/env.test.ts`

- [ ] **Step 1: Add failing tests**

Create tests that verify missing required public Supabase variables produce clear errors, server-only variables are read only from server modules, and `SUPABASE_SERVICE_ROLE_KEY` is not exposed through client env.

- [ ] **Step 2: Implement env modules**

Use internal TypeScript validation without adding a new dependency unless needed. Export lazy getters so `next build` does not initialize server clients at module scope.

- [ ] **Step 3: Add examples**

Document only variable names and comments. Required names: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `DIRECT_URL`. Include `SUPABASE_SERVICE_ROLE_KEY` only as server-only/admin optional.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- apps/web/src/lib/env/env.test.ts
npm run typecheck
git add .env.example apps/web/.env.example apps/web/src/lib/env
git commit -m "chore: add vercel supabase environment validation"
```

## Task 4: Add Supabase Client Layer

**Files:**
- Create: `apps/web/src/lib/supabase/browser.ts`
- Create: `apps/web/src/lib/supabase/server.ts`
- Create: `apps/web/src/lib/supabase/middleware.ts`
- Create: `apps/web/src/lib/supabase/admin.ts`
- Modify: `apps/web/src/lib/supabase/client.ts`
- Test: `apps/web/src/lib/supabase/supabase-clients.test.ts`

- [ ] **Step 1: Install SSR helper**

Run:

```bash
npm install @supabase/ssr
```

- [ ] **Step 2: Add tests**

Test that browser/server/middleware clients use public keys and admin client refuses to initialize without server-only service role.

- [ ] **Step 3: Implement clients**

Use `createBrowserClient` and `createServerClient` from `@supabase/ssr`. Keep admin client lazy and server-only.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- apps/web/src/lib/supabase/supabase-clients.test.ts
npm run typecheck
git add package.json package-lock.json apps/web/src/lib/supabase
git commit -m "feat: add supabase database clients"
```

## Task 5: Create Supabase PostgreSQL Schema And RLS Foundation

**Files:**
- Create: `supabase/migrations/<generated>_recalc_admin_core.sql`
- Create: `docs/database-migration.md`
- Create: `scripts/export-d1-data.ts`
- Create: `scripts/transform-d1-to-postgres.ts`
- Create: `scripts/import-supabase-data.ts`
- Create: `scripts/validate-migrated-data.ts`

- [ ] **Step 1: Generate migration with Supabase CLI if available**

Run:

```bash
supabase --version || true
supabase migration new recalc_admin_core
```

If CLI is unavailable, create a clearly versioned SQL file manually and document why.

- [ ] **Step 2: Add schema SQL**

Create `recalc_admin`, `profiles`, `organizations`, `organization_members`, roles/permissions support, representative domain tables needed by current routes, updated_at trigger function, indexes, foreign keys and RLS policies.

- [ ] **Step 3: Add migration scripts**

Scripts must support `--dry-run`, `--input`, `--output`, `--batch-size`, avoid secrets in args, log counts, and be resumable by primary keys where practical.

- [ ] **Step 4: Document**

Write D1 to PostgreSQL mapping, data load order, integrity checks, orphan queries and rollback notes in `docs/database-migration.md`.

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck
npm test
git add supabase/migrations docs/database-migration.md scripts/export-d1-data.ts scripts/transform-d1-to-postgres.ts scripts/import-supabase-data.ts scripts/validate-migrated-data.ts
git commit -m "feat: add supabase postgresql migration foundation"
```

## Task 6: Migrate Authentication To Supabase Auth

**Files:**
- Modify: `apps/web/middleware.ts`
- Create: `apps/web/src/app/auth/callback/route.ts`
- Create: `apps/web/src/lib/auth/session.ts`
- Modify: `apps/web/src/lib/auth/server.ts`
- Modify: `apps/web/src/lib/auth/client.ts`
- Modify: protected layouts and auth pages as needed
- Create: `docs/auth-migration.md`

- [ ] **Step 1: Add tests**

Add tests for unauthenticated redirects, session recovery, protected admin route, user without organization, member and admin checks.

- [ ] **Step 2: Implement session utilities**

Use Supabase Auth user as identity and domain tables for authorization. Do not use `user_metadata` for authorization.

- [ ] **Step 3: Replace middleware**

Refresh Supabase cookies in middleware and keep detailed authorization in server components/handlers.

- [ ] **Step 4: Document and commit**

```bash
npm test -- auth
npm run typecheck
git add apps/web/middleware.ts apps/web/src/app/auth apps/web/src/lib/auth docs/auth-migration.md
git commit -m "feat: migrate authentication to supabase auth"
```

## Task 7: Migrate Realtime

**Files:**
- Modify: `apps/web/src/lib/supabase/client.ts`
- Modify: `apps/web/src/hooks/useRealtimeMessages.ts`
- Modify: `apps/web/src/hooks/useRealtimePresence.ts`
- Modify: `packages/realtime/src/*`
- Create: `docs/realtime-migration.md`

- [ ] **Step 1: Add tests**

Cover channel construction, cleanup, duplicate listener prevention, org/thread filtering and degraded behavior.

- [ ] **Step 2: Replace message Broadcast for persisted data**

Use `postgres_changes` on `inbox_message`, `training_message` or equivalent persisted tables with filters. Keep Broadcast only for ephemeral events and Presence only for presence.

- [ ] **Step 3: Document and commit**

```bash
npm test -- realtime
npm run typecheck
git add apps/web/src/lib/supabase apps/web/src/hooks packages/realtime docs/realtime-migration.md
git commit -m "feat: replace outbox realtime with postgres changes"
```

## Task 8: Migrate Storage

**Files:**
- Create: `apps/web/src/lib/storage/types.ts`
- Create: `apps/web/src/lib/storage/supabase-storage.ts`
- Modify: file APIs under `apps/web/src/app/api/files`
- Modify: extension upload route
- Create: `scripts/migrate-r2-to-supabase-storage.ts`
- Create: `docs/storage-migration.md`

- [ ] **Step 1: Add tests**

Cover upload allow/reject, signed URL creation, org path validation, MIME and size constraints.

- [ ] **Step 2: Implement adapter**

Expose `upload`, `download`, `remove`, `getSignedUrl`, `getPublicUrl`, `list`.

- [ ] **Step 3: Add migration script**

Support `--dry-run`, retries, size/hash validation where source metadata is available, duplicate handling and report output.

- [ ] **Step 4: Document and commit**

```bash
npm test -- storage
npm run typecheck
git add apps/web/src/lib/storage apps/web/src/app/api/files scripts/migrate-r2-to-supabase-storage.ts docs/storage-migration.md
git commit -m "feat: migrate file storage adapter to supabase"
```

## Task 9: Prepare Vercel

**Files:**
- Modify: `vercel.json`
- Modify: `.github/workflows/quality-release-gate.yml` if needed
- Create: `docs/vercel-deployment.md`
- Create: `docs/migration-rollback.md`

- [ ] **Step 1: Simplify Vercel config**

Favor automatic Next.js detection. Root directory is repository root unless Vercel project is configured to use `apps/web`; document both options and choose one.

- [ ] **Step 2: Remove DB mutation from build**

Retire `scripts/vercel-build.sh` from build command. Do not run migrations during Vercel build.

- [ ] **Step 3: Document deployment and rollback**

Include Preview branch, Supabase Auth URLs, env matrix, staging deployment checklist and Cloudflare rollback.

- [ ] **Step 4: Commit**

```bash
git add vercel.json docs/vercel-deployment.md docs/migration-rollback.md scripts/vercel-build.sh
git commit -m "chore: add vercel deployment configuration"
```

## Task 10: Final Validation And Report

**Files:**
- Create: `docs/migration-validation.md`
- Create: `docs/migration-final-report.md`
- Modify: `README.md`

- [ ] **Step 1: Run final local validation**

```bash
npm ci --foreground-scripts
npm run lint
npm run typecheck
npm test
npm run build
```

- [ ] **Step 2: Run local app checks**

Start the app with:

```bash
npm run dev
```

Check representative public, auth, admin, API, realtime and storage routes locally. If Supabase staging credentials are absent, document the exact missing validations.

- [ ] **Step 3: Search for active legacy references**

```bash
git grep -n -I -E "cloudflare|wrangler|open-next|opennext|D1|R2|getCloudflareContext|env\\.DB|env\\.BUCKET" -- . ':!legacy/cloudflare/**' ':!docs/**' ':!package-lock.json'
```

- [ ] **Step 4: Write final report and commit**

```bash
git add README.md docs/migration-validation.md docs/migration-final-report.md
git commit -m "docs: document migration and deployment"
```

- [ ] **Step 5: Leave branch ready for PR**

Run:

```bash
git status --short --branch
git log --oneline origin/main..HEAD
```
