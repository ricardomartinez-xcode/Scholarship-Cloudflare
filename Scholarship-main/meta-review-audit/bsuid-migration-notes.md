# BSUID Migration Notes

## Migration file
- `C:\Users\ricar\Scholarship\prisma\migrations\20260404_waba_app_review_foundation\migration.sql`

## Schema changes introduced
- `recalc_admin.user_contact`
  - added `wa_id`
  - added `bsuid`
  - added `parent_bsuid`
  - added `whatsapp_username`
  - added `profile_picture_url`
  - added `profile_source`
  - added `last_profile_sync_at`
  - added `last_identity_sync_at`
  - added unique indexes for `(owner_user_id, wa_id)` and `(owner_user_id, bsuid)`
- `recalc_admin.user_meta_whatsapp_connection`
  - added reviewer/audit metadata for graph version, business/WABA/phone state, sync timestamps, granted scopes, and account snapshot JSON
- new tables:
  - `recalc_admin.meta_whatsapp_message`
  - `recalc_admin.meta_whatsapp_message_event`

## Backward compatibility
- Phone-based contact lookup remains intact.
- New identity fields are nullable, so existing contacts continue to work without backfill.
- The upsert flow only promotes richer identity when Meta actually sends it.

## Rollout cautions
- Apply the migration only after confirming the target database is approved for schema changes.
- Redeploy or restart the app after migration so Prisma client and runtime schema match.
- After deployment, run a controlled WABA sync and a controlled webhook test to confirm rows populate in the new message/event tables.

## No destructive data rewrite in this patch
- No contact rows are deleted by the migration itself.
- No phone-only contacts are automatically merged in SQL.
- Identity consolidation happens at runtime through the new upsert logic.
