# D1 domain foundation

This change adds the D1 schema foundation for the next Cloudflare migration phase:

- organizations, memberships, invitations and audit events;
- durable quote history and snapshots;
- idempotent import jobs and checkpoints;
- encrypted Google OAuth connection metadata and sync jobs;
- durable inbox / conversation records and webhook receipts;
- idempotency records and an outbox ledger for Queue delivery.

## Deployment procedure

1. Apply `0001` and `0002` to a fresh staging D1 database.
2. Run `apps/web/scripts/d1-preflight.sql` against staging.
3. Apply migrations `0003` through `0008`.
4. Run `PRAGMA foreign_key_check` and validate the expected tables.
5. Exercise the repository functions with a staging Worker before enabling any admin, Google OAuth, import or realtime endpoint.
6. Before production, record a D1 recovery point and confirm the rollback plan.

## Runtime configuration

`GOOGLE_TOKEN_ENCRYPTION_KEY` is required only when Google OAuth endpoints are enabled. It must be a base64url-encoded random 32-byte key and must be stored as a Worker secret. It is intentionally not declared as a required secret in `wrangler.jsonc`, because Google OAuth is not enabled by these migrations.

The migrations do not create Queues, Durable Objects or Google OAuth callbacks. Those bindings and handlers must be added in a later, separately reviewed change.
