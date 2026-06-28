# D1 migration readiness

Este procedimiento no aplica migraciones ni importa datos. Su único propósito es recolectar evidencia antes de cualquier corte hacia D1.

## Ejecución

En GitHub Actions ejecuta **D1 Migration Readiness** sobre `main` y escribe `READONLY` como confirmación. El workflow:

1. Rechaza el SQL de auditoría si contiene sentencias mutantes.
2. Guarda el manifiesto local de migraciones y los prefijos numéricos repetidos.
3. Consulta el estado remoto con `wrangler d1 migrations list --remote`.
4. Ejecuta `apps/web/scripts/d1-preflight.sql` contra D1 remoto.
5. Conserva la evidencia del run durante catorce días.

## Criterio previo a una migración

Antes de ejecutar `npm run d1:migrations:apply`, revisar:

- El reporte remoto de migraciones y el manifiesto local.
- Tablas y esquema esperados en `d1-preflight.json`.
- `PRAGMA foreign_key_check` sin inconsistencias.
- Conteos de entidades críticas y el plan de reconciliación.
- Respaldo verificable y rollback documentado.

Los prefijos repetidos de nombres de archivo son una señal para revisión manual. No deben renombrarse retrospectivamente ni corregirse mediante borrado de registros de migración sin comparar primero el historial remoto.
