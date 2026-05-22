# WABA Gap Analysis

## What already existed before this patch
- The repo already had a WABA tab entry point inside `src/components/unidep/UnidepWorkspace.tsx`.
- The old implementation could launch Embedded Signup and exchange a Meta code for a token.
- A basic direct-send path existed, but it was effectively text-only and had no reviewer-grade evidence trail.
- Contacts were already stored, but their identity model was largely phone-centric.

## What was broken or missing before this patch
- No reviewer-oriented WABA overview existed for business metadata, WABA metadata, phone metadata, or connection diagnostics.
- No official Meta template listing existed inside the WABA tab, so internal Recalc drafts could be confused with real WhatsApp templates.
- No real media upload/retrieval API existed for App Review evidence.
- No webhook verification or webhook event persistence existed, so delivery/read/failure evidence could not be shown honestly.
- No BSUID-first or `wa_id`-aware deduplication existed; contact linkage depended too heavily on phone number.
- No environment audit existed in-product, so missing Meta variables surfaced only as broken behavior, not as reviewer-readable blockers.
- The WABA UI was not optimized for App Review videos: labels were mixed, states were unclear, and success/error evidence was weak.

## What was added in this patch
- A new reviewer-focused WABA surface in `src/components/unidep/WabaEmbeddedSignupSection.tsx` with clear connection, assets, templates, send, identity, message history, and webhook evidence areas.
- A real Meta WhatsApp service layer in `src/lib/meta-whatsapp.ts` covering:
  - token exchange and token validation
  - asset sync for business/WABA/phone/business profile
  - official template listing
  - text/template/media send payloads
  - media upload, metadata lookup, and download
  - webhook signature validation, inbound message processing, and status persistence
  - environment auditing and reviewer blockers
- New API routes for WABA overview, media upload/download, and webhook handling under `src/app/api/integrations/meta/`.
- A stronger contact identity model and upsert flow in `src/lib/user-contacts.ts`.
- Schema support for persisted WABA messages, message events, and BSUID-related contact fields.
- Playwright configuration and a dedicated WABA App Review spec under `tests/e2e/waba-app-review.spec.ts`.

## What is intentionally out of scope
- `business_management` is still excluded because the repo does not implement a real Business Manager action.
- Internal Recalc template drafts are intentionally not used to justify `whatsapp_business_management`.
- Business profile fields are only shown when actually available; no fabricated field usage was added.

## What still cannot be claimed as complete
- End-to-end reviewer flows are blocked by missing Meta credentials in local env and in linked Vercel env.
- Webhook verification cannot be proven live because `META_WEBHOOK_VERIFY_TOKEN` is not configured.
- Message/media E2E validation cannot run because there is no reviewer-safe contact, no opt-in send flag, and no media fixture configured.
- Final App Review videos cannot be honestly generated yet because the live flows cannot be demonstrated.

## What would still fail reviewer scrutiny if submitted today
- A reviewer cannot complete Embedded Signup because the public Meta app/config variables are absent.
- A reviewer cannot see real WABA assets, templates, or phone details because no live connection can be synced.
- A reviewer cannot see live delivery evidence because the webhook path is not configured end-to-end.
- A reviewer cannot reproduce BAUPA/BSUID proof because there is no live data for those fields in this environment.
