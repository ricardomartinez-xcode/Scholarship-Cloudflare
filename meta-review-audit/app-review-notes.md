# App Review Notes

## Permissions and features that are truly justified by the product behavior
- `whatsapp_business_messaging`
  - Recalc now has a reviewer-visible WABA send surface for text, template, and media sends.
  - Recalc now persists outbound/inbound message evidence and webhook status events in dedicated tables.
  - Main WABA areas: `Send action`, `Recent messages`, `Webhook and delivery evidence`.
- `whatsapp_business_management`
  - Recalc now has a reviewer-visible WABA management surface for embedded signup, connection status, business/WABA/phone metadata, and official Meta template listing.
  - Main WABA areas: `Connection status`, `Business assets`, `Official Meta templates`, `Launch Embedded Signup`, `Sync from Meta`.

## Permissions and features that are not currently justified
- `business_management`
  - No real Business Manager action exists in the product after the repo audit.
  - The permission remains intentionally out of scope and no reviewer video should be recorded for it.

## Conditional / not yet safe to claim
- Business Asset User Profile Access
  - The code can now store and show identity/profile fields if Meta really returns them.
  - A submission is still unsafe until live reviewer-visible data proves the product actually uses those fields.
- BSUID identity flow
  - The code now supports BSUID-aware deduplication and display.
  - A standalone BSUID review video is still blocked until a live account produces real BSUID/profile data.

## What was implemented
- Rebuilt the WABA tab for reviewer readability and auditability.
- Added WABA asset sync and overview APIs.
- Added official Meta template listing support.
- Added real media upload/download support.
- Added webhook verification and persistence for delivery evidence.
- Added BSUID-aware contact identity storage and deduplication.
- Added Playwright coverage and audit artifact output paths under `meta-review-audit/`.

## What remains blocked
- Missing Meta env vars locally and in linked Vercel.
- Missing reviewer-safe auth credentials for E2E.
- Missing live WABA connection, target contact, media file, and webhook subscription.
- Final Meta App Review videos cannot be honestly recorded yet.
