# Cloudflare Workers Migration

This repository is a Cloudflare/OpenNext port of `ricardomartinez-xcode/Scholarship`.

## Current Target

- Runtime: Cloudflare Workers via `@opennextjs/cloudflare`.
- Database: Cloudflare D1 database `recalc-cloudflare`.
- Build output: `apps/web/.open-next/worker.js` plus `apps/web/.open-next/assets`.
- Production hostname: `recalc.relead.com.mx` (custom domain managed in the Cloudflare Dashboard).
- Local preview: `npm run preview:cloudflare`.
- Deploy: `npm run deploy:cloudflare` (builds OpenNext, prepares a Terser-minified Worker, then deploys it with `wrangler deploy --no-bundle`).

## Environment Backup

The original Vercel variables were exported on the workstation before this port was created:

```text
/home/unidep/Escritorio/vercel-env-backup-scholarship-20260626-111748/
```

That folder is intentionally outside this repository and must not be committed.

## Removed Platform Direction

The requested target is Cloudflare without Neon Auth, Neon, or Supabase. This fork now separates Prisma from the Cloudflare Worker bundle and uses D1 for the core public/calculator data path.

Current Cloudflare-native pieces:

1. D1 migrations in `apps/web/migrations`.
2. D1 auth/session tables and cookie-based auth for `/auth/sign-in` and `/auth/sign-up`.
3. D1 read layer for the core UNIDEP data endpoints: `/api/data/pricing-options`, `/api/public/oferta`, `/api/public/planes`, and `/api/public/costos`.
4. Prisma, Neon Auth, and Supabase shims for the Worker build so those packages do not ship their server runtimes into Cloudflare.

Still staged for later migration:

1. Admin mutations/importers.
2. Inbox, training, WhatsApp/Meta persistence, Google sync, and quote history writes.
3. A Cloudflare-native replacement for Supabase realtime/browser clients if those features remain required.
4. Full Worker secret synchronization for every non-Neon/non-Supabase integration.

Sentry's Next.js instrumentation files were removed in this Cloudflare fork because the OpenNext bundle failed while tracing `server/instrumentation.js`. Reintroduce observability with a Workers-native Sentry setup after the Cloudflare runtime is stable.

## Cloudflare Commands

```bash
npm install
npm run build:cloudflare
npm run d1:migrations:apply
npm run d1:sync-core
npm run preview:cloudflare
npm run deploy:cloudflare
```

`apps/web/wrangler.jsonc` includes `recalc.relead.com.mx` as a Worker Custom Domain.
After the first successful deploy, Cloudflare should manage the DNS record and
certificate for that hostname.

## GitHub Actions Deployment

This fork includes `.github/workflows/cloudflare-workers.yml`.

Set these repository secrets before using the workflow:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
DIRECT_URL
DATABASE_URL_UNPOOLED
DATABASE_URL
```

`DIRECT_URL`, `DATABASE_URL_UNPOOLED`, or `DATABASE_URL` is only used by the workflow to export the existing Prisma/Postgres data into D1 before deploy. The Worker runtime does not use Neon/Postgres.

The Cloudflare token must be an API token with Workers and D1 permissions. A Cloudflared tunnel token is not valid for Wrangler API calls.

## Worker Size

The current OpenNext build succeeds and can fit under the Workers Free 3 MiB
gzip limit when deployed through the prepared no-bundle artifact.

The latest direct Wrangler minified dry-run on 2026-06-26 is still too large:

```text
wrangler deploy --dry-run --minify
Total Upload: 13354.61 KiB / gzip: 3218.42 KiB
```

`npm run deploy:cloudflare` therefore runs `scripts/prepare-cloudflare-deploy.mjs`
after `opennextjs-cloudflare build`. That script asks Wrangler to bundle into
`.wrangler-bundle/worker.js`, minifies the final ESM Worker with Terser, checks
the gzip size, and deploys `.wrangler-bundle/worker.terser.js` with
`wrangler deploy --no-bundle`.

Latest prepared artifact:

```text
.wrangler-bundle/worker.terser.js
Total Upload: 13019.91 KiB / gzip: 2956.57 KiB
```

If this prepared artifact ever grows above 3072 KiB gzip, the script fails
before deploy and the next options are a route split for heavy XLSX/admin
imports or upgrading Workers to the Paid limit.

The Wrangler config intentionally does not re-declare the `recalc.relead.com.mx`
custom domain. The domain already exists in Cloudflare and re-publishing it from
Wrangler returns a `409` conflict on `/workers/scripts/.../domains/records`.
Deploys leave that dashboard-managed custom domain in place and publish the
Worker version through the configured workers.dev trigger.

The current Cloudflare API token can authenticate and read Worker deployments,
but D1 operations fail with `Authentication error` / `7403`. Before applying
migrations or deploying from CI, make sure the token has D1 edit/read
permissions for account `41ffa6a1a7c184fd4308f87780a62cc4`.

## D1 Data Sync

Generate SQL from the backed up Vercel/Postgres environment:

```bash
npm run d1:export-core -- --env-file=/home/unidep/Escritorio/vercel-env-backup-scholarship-20260626-111748/production.env
```

Apply it to D1:

```bash
npm run d1:import-core
```

The generated SQL is written to `apps/web/.tmp/d1-core-data.sql`, which is ignored by git.

## Secret Import Notes

Use the backed up Vercel env files as the source of truth, but do not bulk-import Neon, Neon Auth, or Supabase variables into Cloudflare for this port.

Cloudflare secrets should be set with:

```bash
npx wrangler secret put VARIABLE_NAME
```

Non-secret build/runtime variables can be added under `vars` in `wrangler.jsonc`.
