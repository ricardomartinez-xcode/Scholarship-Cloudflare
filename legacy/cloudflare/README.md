# Legacy Cloudflare Runtime

This directory preserves the previous Cloudflare Workers/OpenNext/D1/R2 configuration for rollback and historical reference while the Vercel + Supabase migration is developed.

Files here are not part of the active Next.js/Vercel build path.

Do not run these commands against production from this migration branch:

- `wrangler deploy`
- `wrangler d1 migrations apply --remote`
- Worker artifact promotion
- DNS or route changes

The current production Cloudflare infrastructure remains untouched until a separately approved cutover.
