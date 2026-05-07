# BSUID Requirements

## What the official docs require
- Meta documents business-scoped user IDs as business-specific identifiers that help keep a stable mapping for a user within a business context. This matters when phone number alone is not a durable primary key. https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids
- The Business Asset User Profile Access feature is limited to profile fields such as `id`, `ids_for_business`, `name`, and `picture`. Those fields should only be stored or displayed if the product really uses them. https://developers.facebook.com/docs/features-reference/business-asset-user-profile-access/

## Why BSUID matters for Recalc
- Recalc stores contacts and conversation evidence for WABA review flows.
- If Meta sends `wa_id`, BSUID, username, or profile data that does not perfectly match the stored phone string, the app still needs a stable way to keep one contact record and one message timeline.
- Reviewer evidence is stronger when the UI can show where identity came from and when it was last synced.

## Minimal field usage policy in this implementation
- `id`: not stored from a dedicated Business Asset User Profile endpoint in this patch.
- `ids_for_business`: represented only when business-scoped identifiers arrive through WhatsApp-related payloads and are normalized into `bsuid` / `parentBsuid`. No separate BAUPA fetch was added.
- `name`: used only when Meta sends a name and Recalc needs it to label the contact record.
- `picture`: used only when Meta sends a profile picture URL and Recalc needs it for the reviewer-visible identity panel.

## Practical reviewer requirement
- A BSUID/identity reviewer flow is only valid if the WABA tab can show:
  - the linked Recalc contact
  - the stable Meta-side identifier actually received
  - the source of the identity/profile data
  - the last sync time
  - graceful fallback when the data is absent

## Current conclusion
- BSUID support is required for data correctness in Recalc whenever Meta provides those identifiers.
- Business Asset User Profile Access is not yet safe to claim as a standalone reviewer permission until live data proves that the required fields are actually returned and used end-to-end.
