#!/bin/sh
# Compatibility alias for older Vercel project settings.
# The Supabase migration keeps database migrations out of the build step.

set -e

echo "[vercel-build] Running standard Next.js build"
npm run build
