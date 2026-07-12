# Legacy Neon Auth

This directory preserves the retired Neon Auth admin panel, webhook endpoints,
configuration scripts, and historical documentation for rollback analysis.

Nothing under this directory is part of the Next.js source tree, lint target,
test discovery, or Vercel deployment. The active authentication implementation
uses Supabase Auth under `apps/web/src/lib/auth` and `apps/web/src/lib/supabase`.

Do not restore these files into `apps/web/src` without a reviewed rollback plan.
They require obsolete Neon-specific credentials and do not participate in the
current user session flow.
