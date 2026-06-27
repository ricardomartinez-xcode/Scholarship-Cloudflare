-- Safe read-only preflight. Run this locally and against staging before remote production migrations.

SELECT 'tables' AS section, name
FROM sqlite_master
WHERE type = 'table'
ORDER BY name;

SELECT 'current_schema' AS section, name, sql
FROM sqlite_master
WHERE type = 'table'
  AND name IN (
    'campus', 'program', 'program_offering', 'academic_fee',
    'cloudflare_auth_user', 'cloudflare_auth_session',
    'file_asset', 'file_asset_usage',
    'admin_price_override', 'admin_sidebar_info'
  )
ORDER BY name;

PRAGMA foreign_key_check;

SELECT 'core_counts' AS section, 'campus' AS table_name, COUNT(*) AS row_count FROM campus
UNION ALL SELECT 'core_counts', 'program', COUNT(*) FROM program
UNION ALL SELECT 'core_counts', 'program_offering', COUNT(*) FROM program_offering
UNION ALL SELECT 'core_counts', 'academic_fee', COUNT(*) FROM academic_fee
UNION ALL SELECT 'core_counts', 'cloudflare_auth_user', COUNT(*) FROM cloudflare_auth_user
UNION ALL SELECT 'core_counts', 'cloudflare_auth_session', COUNT(*) FROM cloudflare_auth_session;
