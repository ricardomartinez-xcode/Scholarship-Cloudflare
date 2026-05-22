# BSUID Gap Analysis

## Before this patch
- `UserContact` relied mainly on `phone` and `normalizedPhone`.
- No first-class `wa_id`, BSUID, parent BSUID, username, or profile picture fields existed in the contact model.
- No shared deduplication flow existed for Meta webhook payloads versus direct send flows.
- The WABA tab had no reviewer-visible identity panel.

## After this patch
- `UserContact` now stores:
  - `waId`
  - `bsuid`
  - `parentBsuid`
  - `whatsappUsername`
  - `profilePictureUrl`
  - `profileSource`
  - `lastProfileSyncAt`
  - `lastIdentitySyncAt`
- `src/lib/user-contacts.ts` now resolves identity by priority:
  1. `bsuid`
  2. `waId`
  3. normalized phone
- Direct send and webhook ingestion now both reuse the same identity upsert logic.
- The WABA tab now exposes a dedicated `Identity and BSUID` panel for reviewer visibility.

## Remaining gaps
- No live BAUPA payloads were available in this environment, so `id`, `ids_for_business`, `name`, and `picture` could not be validated from a true business profile call.
- No live webhook subscription was available, so inbound BSUID/profile updates could not be demonstrated end-to-end.
- Existing downstream CRM sync layers outside `user-contacts.ts` were not expanded in this session because no additional Meta identity consumer was found in the audited WABA path.

## Risk assessment
- The storage and deduplication model is now materially safer than the previous phone-only design.
- Review readiness for BSUID remains blocked by missing live data, not by missing code paths.
