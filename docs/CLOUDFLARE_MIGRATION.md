# Cloudflare Workers Migration

This repository is a Cloudflare/OpenNext port of `ricardomartinez-xcode/Scholarship`.

## Current Target

- Runtime: Cloudflare Workers via `@opennextjs/cloudflare`.
- Database: Cloudflare D1 database `recalc-cloudflare`.
- Build output: `apps/web/.open-next/worker.js` plus `apps/web/.open-next/assets`.
- Production hostname: `recalc.relead.com.mx` (custom domain managed in the Cloudflare Dashboard).
- Local preview: `npm run preview:cloudflare`.
- Deploy: `npm run deploy:cloudflare` (builds OpenNext, prepares a Terser-minified Worker, then deploys it with `wrangler deploy --no-bundle`).

## Local Verification

Latest local verification on 2026-06-29:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build:cloudflare`: passed.
- `npm --workspace @relead/web run prepare:cloudflare`: passed as a Wrangler dry-run and produced `.wrangler-bundle/worker.terser.js`.

`build:cloudflare` now runs the repository typecheck first and then skips the duplicate internal Next.js type validation only inside the Cloudflare build. This keeps the same type gate while avoiding the local OpenNext build being killed during Next's second TypeScript pass.

Remote Cloudflare metadata is not verified from the connector in this checkout. Read-only calls for D1, R2 and Workers returned `Unexpected response type`, so remote D1 migrations, bucket contents, custom domain state and deployed Worker versions still need Wrangler/API confirmation with a working Cloudflare token.

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
```

The deploy/preflight workflow should only require Cloudflare credentials. `DIRECT_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_*`, `DATABASE_URL`, `NEON_*` and `SUPABASE_*` are not Worker runtime secrets for the target architecture. Use them only in a separate, explicitly authorized one-shot export/audit job before D1 cutover.

The Cloudflare token must be an API token with Workers and D1 permissions. A Cloudflared tunnel token is not valid for Wrangler API calls.

## Worker Size

Cloudflare's current Workers limits are 3 MB gzip on Workers Free and 10 MB gzip on Workers Paid. The prepared artifact currently targets the Paid limit unless `CLOUDFLARE_WORKER_GZIP_LIMIT_BYTES` is set.

Latest prepared artifact on 2026-06-29:

```text
.wrangler-bundle/worker.terser.js
Total Upload: 13833.71 KiB / gzip: 3337.29 KiB
```

That is deployable on Workers Paid or a higher approved limit, but it is over the 3 MB Workers Free limit. If the target account is Free, set this in CI/preflight so the release fails before deploy:

```text
CLOUDFLARE_WORKER_GZIP_LIMIT_BYTES=3145728
```

Then split heavy routes/importers or remove unused dependencies until the prepared gzip size is below the configured limit.

`npm run deploy:cloudflare` runs `scripts/prepare-cloudflare-deploy.mjs` after `opennextjs-cloudflare build`. That script asks Wrangler to bundle into `.wrangler-bundle/worker.js`, optionally minifies the final ESM Worker with Terser, checks the gzip size, and deploys `.wrangler-bundle/worker.terser.js` with `wrangler deploy --no-bundle`.

If this prepared artifact grows above the configured gzip limit, the script fails before deploy and the next options are route splitting for heavy XLSX/admin imports, dependency removal, Workers Paid, or a Cloudflare limit increase.

The Wrangler config intentionally does not re-declare the `recalc.relead.com.mx`
custom domain. The domain already exists in Cloudflare and re-publishing it from
Wrangler returns a `409` conflict on `/workers/scripts/.../domains/records`.
Deploys leave that dashboard-managed custom domain in place and publish the
Worker version through the configured workers.dev trigger.

The current Cloudflare API token can authenticate and read Worker deployments,
but D1 operations fail with `Authentication error` / `7403`. Before applying
migrations or deploying from CI, make sure the token has D1 edit/read
permissions for account `41ffa6a1a7c184fd4308f87780a62cc4`.

## Cloudflare Bindings And Secrets

Versioned bindings in `apps/web/wrangler.jsonc`:

- Worker: `scholarship-cloudflare`.
- D1: `DB` bound to `recalc-cloudflare` (`2a2bbd32-55af-4ff3-aea2-8f8b11d2a05d`).
- Temporary D1 compatibility binding: `MYSQL` points to the same D1 database.
- R2: `Assets` bound to bucket `recalc`.
- Static assets binding: `ASSETS`.
- Send Email binding: `Recalc`.
- Service binding: `WORKER_SELF_REFERENCE`.
- Non-secret vars: `NEXT_PUBLIC_APP_ENV=cloudflare`, `CLOUDFLARE_OWNER_EMAILS`.

Required Worker secrets for the current Cloudflare-native auth path:

```text
CLOUDFLARE_OWNER_PASSWORD
CLOUDFLARE_AUTH_RATE_LIMIT_PEPPER
```

Required only if the corresponding integration is enabled before its full Cloudflare-native replacement:

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI
GOOGLE_TOKEN_ENCRYPTION_KEY
GOOGLE_TOKEN_ENCRYPTION_KEY_VERSION
META_APP_ID
META_APP_SECRET
META_INTEGRATION_SECRET
META_WEBHOOK_VERIFY_TOKEN
META_CONVERSIONS_DATASET_ID
META_CONVERSIONS_ACCESS_TOKEN
WEB_PUSH_PRIVATE_KEY
WEB_PUSH_SUBJECT
ASSET_HEALTH_API_TOKEN
```

Temporary compatibility secrets that should be retired from the Worker target:

```text
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_ENDPOINT
R2_BUCKET
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
```

The R2 S3 variables are only needed by legacy S3-style R2 helpers. Cloudflare binding-based R2 code should use the `Assets` binding instead. SMTP variables are only needed while `nodemailer` remains in active routes; the target is Send Email or another Worker-compatible mail adapter.

Do not import these legacy provider variables into the Worker runtime for the target architecture:

```text
DATABASE_URL
DIRECT_URL
POSTGRES_PRISMA_URL
POSTGRES_URL
POSTGRES_URL_NON_POOLING
DATABASE_URL_UNPOOLED
NEON_API_KEY
NEON_AUTH_BASE_URL
NEON_AUTH_COOKIE_SECRET
NEON_AUTH_WEBHOOK_SECRET
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_REALTIME_JWT_SECRET
```

Those names still appear in legacy routes, scripts and docs. They are blockers to a complete Cloudflare-only cutover, not required production Worker secrets.

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
