# Cloudflare Workers Migration

This repository is a Cloudflare/OpenNext port of `ricardomartinez-xcode/Scholarship`.

## Current Target

- Runtime: Cloudflare Workers via `@opennextjs/cloudflare`.
- Build output: `apps/web/.open-next/worker.js` plus `apps/web/.open-next/assets`.
- Production hostname: `recalc.relead.com.mx`.
- Local preview: `npm run preview:cloudflare`.
- Deploy: `npm run deploy:cloudflare`.

## Environment Backup

The original Vercel variables were exported on the workstation before this port was created:

```text
/home/unidep/Escritorio/vercel-env-backup-scholarship-20260626-111748/
```

That folder is intentionally outside this repository and must not be committed.

## Removed Platform Direction

The requested target is Cloudflare without Neon Auth, Neon, or Supabase. The original codebase still contains many imports and runtime contracts for those providers. The migration should remove those in stages:

1. Replace Neon Auth routes/session helpers with a Cloudflare-compatible auth layer.
2. Replace Prisma/Neon database access with a Cloudflare-supported persistence layer.
3. Replace Supabase realtime/browser clients with Cloudflare-native primitives or a selected external provider.
4. Move Vercel-provided variables into Cloudflare Worker secrets and plain vars.

Sentry's Next.js instrumentation files were removed in this Cloudflare fork because the OpenNext bundle failed while tracing `server/instrumentation.js`. Reintroduce observability with a Workers-native Sentry setup after the Cloudflare runtime is stable.

## Cloudflare Commands

```bash
npm install
npm run build:cloudflare
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

The token must be a Cloudflare API token with Workers deploy permissions. A
Cloudflared tunnel token is not valid for Wrangler API calls.

## Current Deploy Blocker

The Cloudflare API token is valid, and GitHub Actions can authenticate with it.
The current Cloudflare account rejected the Worker because the OpenNext bundle is
larger than the free Workers script limit:

```text
Your Worker exceeded the size limit of 3 MiB. Please upgrade to a paid plan to deploy Workers up to 10 MiB.
```

The dry-run upload is about 7.7 MiB gzipped, so the current fork likely requires
a paid Workers plan unless the app is split or large server dependencies are
removed from the Worker bundle.

## Secret Import Notes

Use the backed up Vercel env files as the source of truth, but do not bulk-import Neon, Neon Auth, or Supabase variables into Cloudflare for this port.

Cloudflare secrets should be set with:

```bash
npx wrangler secret put VARIABLE_NAME
```

Non-secret build/runtime variables can be added under `vars` in `wrangler.jsonc`.
