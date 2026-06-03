# Neon Auth integrations

This repo keeps the Neon Auth integration endpoint inside the main Next.js app and deploys it through Vercel.

## Current Neon project

Resolved with Neon actions:

- Project: `Recalc`
- Project ID: `jolly-king-13100259`
- Production/default branch: `production`
- Branch ID: `br-old-mountain-ai239lh2`

## Webhook endpoint

Production URL:

```txt
https://recalc.relead.com.mx/api/integrations/neon-auth/webhook
```

Local route:

```txt
apps/web/src/app/api/integrations/neon-auth/webhook/route.ts
```

The route verifies Neon Auth detached JWS signatures when these environment variables are present:

```env
NEON_AUTH_BASE_URL="https://<branch-auth-host>"
# or
NEON_AUTH_JWKS_URL="https://<branch-auth-host>/.well-known/jwks.json"
```

Signature verification is enabled by default. To temporarily debug in a non-production preview only:

```env
NEON_AUTH_WEBHOOK_VERIFY_SIGNATURE=false
```

## Optional event forwarding

To send verified Neon Auth events to another integration service, configure:

```env
NEON_AUTH_WEBHOOK_FORWARD_URL="https://example.com/integrations/neon-auth"
NEON_AUTH_WEBHOOK_FORWARD_TOKEN="optional-bearer-token"
```

Delivery events like `send.otp` and `send.magic_link` should only be enabled when the deployed route can actually deliver SMS/email directly or can forward to an integration that does it.

## Register or update the Neon Auth webhook

Set your Neon API key locally or in a secure CI environment:

```bash
export NEON_API_KEY="..."
```

Then run:

```bash
npm run neon:auth:webhook
```

Defaults:

```env
NEON_PROJECT_ID=jolly-king-13100259
NEON_BRANCH_ID=br-old-mountain-ai239lh2
NEON_AUTH_WEBHOOK_URL=https://recalc.relead.com.mx/api/integrations/neon-auth/webhook
NEON_AUTH_WEBHOOK_EVENTS=user.created,organization.invitation.created,organization.invitation.accepted,phone.number.verified
NEON_AUTH_WEBHOOK_TIMEOUT_SECONDS=5
```

To include delivery events:

```bash
NEON_AUTH_WEBHOOK_EVENTS="user.created,send.otp,send.magic_link" npm run neon:auth:webhook
```

## List or update OAuth providers

List current branch OAuth providers:

```bash
NEON_API_KEY="..." npm run neon:auth:oauth
```

Update a provider:

```bash
NEON_API_KEY="..." \
NEON_AUTH_OAUTH_PROVIDER="google" \
NEON_AUTH_OAUTH_CLIENT_ID="..." \
NEON_AUTH_OAUTH_CLIENT_SECRET="..." \
npm run neon:auth:oauth
```

Supported provider IDs:

```txt
google
github
microsoft
vercel
```

For Microsoft, set `NEON_AUTH_MICROSOFT_TENANT_ID` when needed.

## Why this is in the monorepo

The webhook belongs in this monorepo while it is lightweight and tightly coupled to the Recalc app. It shares the same deployment, domain, environment management, observability, and review flow.

Move it to a separate service only if it needs independent scaling, queues, retries, longer processing, or different security/release ownership.
