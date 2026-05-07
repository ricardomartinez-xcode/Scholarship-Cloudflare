#!/bin/sh
# vercel-build.sh
#
# Resolves DATABASE_URL and DIRECT_URL from Vercel/Neon integration env vars,
# then syncs the Prisma schema directly to Neon with `prisma db push`
# (no migration files or _prisma_migrations table required).

set -e

# ── DIRECT_URL (plain postgres://, used by prisma db push) ────────────────────
# Vercel's Neon integration exposes POSTGRES_URL_NON_POOLING (direct, non-pooled).
# We prefer that; fall back to DATABASE_URL_UNPOOLED or the main DATABASE_URL
# when it is already a plain postgres:// connection string.
if [ -z "$DIRECT_URL" ]; then
  if [ -n "$POSTGRES_URL_NON_POOLING" ]; then
    export DIRECT_URL="$POSTGRES_URL_NON_POOLING"
    echo "[vercel-build] DIRECT_URL set from POSTGRES_URL_NON_POOLING"
  elif [ -n "$DATABASE_URL_UNPOOLED" ]; then
    export DIRECT_URL="$DATABASE_URL_UNPOOLED"
    echo "[vercel-build] DIRECT_URL set from DATABASE_URL_UNPOOLED"
  elif [ -n "$DATABASE_URL" ]; then
    # Only use DATABASE_URL as DIRECT_URL when it is not a prisma+postgres:// Accelerate URL
    case "$DATABASE_URL" in
      prisma+postgres://*)
        echo "[vercel-build] ERROR: DIRECT_URL is not set and DATABASE_URL is a Prisma Accelerate URL." >&2
        echo "[vercel-build] Add DIRECT_URL = <your Neon direct postgres:// URL> to Vercel env vars." >&2
        exit 1
        ;;
      *)
        export DIRECT_URL="$DATABASE_URL"
        echo "[vercel-build] DIRECT_URL set from DATABASE_URL (plain postgres)"
        ;;
    esac
  else
    echo "[vercel-build] ERROR: DIRECT_URL is not set and no Neon fallback found." >&2
    echo "[vercel-build] Set DIRECT_URL = <your Neon direct/non-pooled postgres:// URL> in Vercel env vars." >&2
    exit 1
  fi
fi

# ── DATABASE_URL (pooled Neon URL for runtime queries) ────────────────────────
# Vercel's Neon integration exposes POSTGRES_PRISMA_URL (pooled, with pgbouncer).
if [ -z "$DATABASE_URL" ]; then
  if [ -n "$POSTGRES_PRISMA_URL" ]; then
    export DATABASE_URL="$POSTGRES_PRISMA_URL"
    echo "[vercel-build] DATABASE_URL set from POSTGRES_PRISMA_URL"
  elif [ -n "$POSTGRES_URL" ]; then
    export DATABASE_URL="$POSTGRES_URL"
    echo "[vercel-build] DATABASE_URL set from POSTGRES_URL"
  elif [ -n "$DIRECT_URL" ]; then
    export DATABASE_URL="$DIRECT_URL"
    echo "[vercel-build] DATABASE_URL set from DIRECT_URL (direct connection)"
  else
    echo "[vercel-build] WARNING: DATABASE_URL not set. Runtime fallback will apply." >&2
  fi
fi

# ── Ensure the recalc_admin schema exists before db push ─────────────────────
# `prisma db push` does not auto-create custom Postgres schemas.
# We create it with the Neon serverless driver (already a project dependency).
echo "[vercel-build] Ensuring recalc_admin schema exists in Neon..."
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DIRECT_URL);
sql\`CREATE SCHEMA IF NOT EXISTS recalc_admin\`
  .then(() => { console.log('[vercel-build] Schema recalc_admin ready.'); process.exit(0); })
  .catch(err => { console.error('[vercel-build] Schema note:', err.message); process.exit(0); });
" || true

# ── Sync Prisma schema to Neon (replaces prisma migrate deploy) ───────────────
# Using db push avoids the _prisma_migrations table and the complex stale-record
# resolution that was needed with migrate deploy.
echo "[vercel-build] Running: prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss --skip-generate"
prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss --skip-generate

echo "[vercel-build] Running: npm --workspace @relead/web run build"
npm --workspace @relead/web run build
