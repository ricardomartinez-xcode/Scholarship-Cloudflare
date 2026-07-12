-- Canonical campus reference data required by the quote and import workflows.
-- The upsert is idempotent and preserves operational fields not owned by this seed.
BEGIN;

INSERT INTO recalc_admin.campus (
  id,
  code,
  "metaKey",
  name,
  slug,
  kind,
  "isActive",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  seed.code,
  seed.meta_key,
  seed.name,
  seed.slug,
  seed.kind::recalc_admin."CampusKind",
  true,
  seed.sort_order,
  now(),
  now()
FROM (
  VALUES
    ('CAMPUS_AGUA_PRIETA', 'Agua Prieta', 'Agua Prieta', 'agua-prieta', 'campus', 10),
    ('CAMPUS_AGUASCALIENTES', 'Aguascalientes', 'Aguascalientes', 'aguascalientes', 'campus', 20),
    ('CAMPUS_ALTAMIRA', 'Altamira', 'Altamira', 'altamira', 'campus', 30),
    ('CAMPUS_CANANEA', 'Cananea', 'Cananea', 'cananea', 'campus', 40),
    ('CAMPUS_CD_DEL_CARMEN', 'Cd. Del Carmen', 'Cd. Del Carmen', 'cd-del-carmen', 'campus', 50),
    ('CAMPUS_CD_MANTE', 'Cd. Mante', 'Cd. Mante', 'cd-mante', 'campus', 60),
    ('CAMPUS_CHIHUAHUA', 'Chihuahua', 'Chihuahua', 'chihuahua', 'campus', 70),
    ('CAMPUS_CULIACAN', 'Culiacán', 'Culiacán', 'culiacan', 'campus', 80),
    ('CAMPUS_ENSENADA', 'Ensenada', 'Ensenada', 'ensenada', 'campus', 90),
    ('CAMPUS_HERMOSILLO', 'Hermosillo', 'Hermosillo', 'hermosillo', 'campus', 100),
    ('CAMPUS_LA_PAZ', 'La Paz', 'La Paz', 'la-paz', 'campus', 110),
    ('CAMPUS_LOS_CABOS', 'Los Cabos', 'Los Cabos', 'los-cabos', 'campus', 120),
    ('CAMPUS_MEXICALI', 'Mexicali', 'Mexicali', 'mexicali', 'campus', 130),
    ('CAMPUS_NOGALES', 'Nogales', 'Nogales', 'nogales', 'campus', 140),
    ('CAMPUS_OBREGON', 'Obregon', 'Obregon', 'obregon', 'campus', 150),
    ('CAMPUS_PUERTO_PENASCO', 'Puerto Peñasco', 'Puerto Peñasco', 'puerto-penasco', 'campus', 160),
    ('CAMPUS_QUERETARO', 'Querétaro', 'Querétaro', 'queretaro', 'campus', 170),
    ('CAMPUS_SALTILLO', 'Saltillo', 'Saltillo', 'saltillo', 'campus', 180),
    ('CAMPUS_TEOCALTICHE', 'Teocaltiche', 'Teocaltiche', 'teocaltiche', 'campus', 190),
    ('CAMPUS_TIJUANA', 'Tijuana', 'Tijuana', 'tijuana', 'campus', 200),
    ('CAMPUS_TORREON', 'Torreon', 'Torreon', 'torreon', 'campus', 210),
    ('CAMPUS_TUXPAN', 'Tuxpan', 'Tuxpan', 'tuxpan', 'campus', 220),
    ('CAMPUS_VERACRUZ', 'Veracruz', 'Veracruz', 'veracruz', 'campus', 230),
    ('CAMPUS_ZACATECAS', 'Zacatecas', 'Zacatecas', 'zacatecas', 'campus', 240),
    ('ONLINE', 'ONLINE', 'Online', 'online', 'online', 1000)
) AS seed(code, meta_key, name, slug, kind, sort_order)
ON CONFLICT (code) DO UPDATE
SET
  "metaKey" = EXCLUDED."metaKey",
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  kind = EXCLUDED.kind,
  "isActive" = true,
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = now();

DO $$
DECLARE
  campus_count integer;
  online_count integer;
BEGIN
  SELECT
    count(*) FILTER (WHERE kind = 'campus'),
    count(*) FILTER (WHERE kind = 'online')
  INTO campus_count, online_count
  FROM recalc_admin.campus
  WHERE code LIKE 'CAMPUS_%' OR code = 'ONLINE';

  IF campus_count <> 24 OR online_count <> 1 THEN
    RAISE EXCEPTION
      'Canonical campus seed mismatch: campus=%, online=%',
      campus_count,
      online_count;
  END IF;
END $$;

COMMIT;
