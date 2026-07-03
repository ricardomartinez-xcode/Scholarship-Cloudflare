-- Safe read-only preflight. Run this locally and against staging before remote production migrations.

WITH required(name) AS (
  VALUES
    ('campus'),
    ('program'),
    ('program_offering'),
    ('academic_fee'),
    ('campus_academic_fee'),
    ('admin_price_override'),
    ('admin_additional_benefit'),
    ('admin_additional_benefit_campus'),
    ('file_asset'),
    ('file_asset_usage'),
    ('cloudflare_auth_user'),
    ('cloudflare_auth_session'),
    ('organization'),
    ('quote_session'),
    ('quote_scenario'),
    ('quote_event'),
    ('import_job'),
    ('oauth_connection'),
    ('conversation'),
    ('conversation_member'),
    ('conversation_message'),
    ('business_event'),
    ('extension_campaign'),
    ('extension_campaign_recipient'),
    ('outbox_event'),
    ('campaign_sender_profile'),
    ('campaign_sender_campaign'),
    ('campaign_sender_recipient'),
    ('campaign_sender_event')
)
SELECT
  'required_table' AS section,
  required.name,
  CASE WHEN sqlite_master.name IS NULL THEN 'missing' ELSE 'present' END AS status
FROM required
LEFT JOIN sqlite_master
  ON sqlite_master.type = 'table'
 AND sqlite_master.name = required.name
ORDER BY required.name;

SELECT 'tables' AS section, name
FROM sqlite_master
WHERE type = 'table'
ORDER BY name;

SELECT 'current_schema' AS section, name, sql
FROM sqlite_master
WHERE type = 'table'
ORDER BY name;

PRAGMA foreign_key_check;
