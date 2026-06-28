-- Safe read-only preflight. Run this locally and against staging before remote production migrations.

SELECT 'tables' AS section, name
FROM sqlite_master
WHERE type = 'table'
ORDER BY name;

SELECT 'current_schema' AS section, name, sql
FROM sqlite_master
WHERE type = 'table'
ORDER BY name;

PRAGMA foreign_key_check;
