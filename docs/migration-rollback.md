# Rollback de migracion Vercel + Supabase

Fecha: 2026-07-12  
Rama: `migration/vercel-supabase`  
Produccion Cloudflare: no modificada

## Principio

La produccion actual en Cloudflare sigue siendo la ruta activa. Esta rama no ejecuta deploys, no cambia DNS, no borra Workers, no borra D1, no borra R2 y no aplica migraciones remotas destructivas.

## Rollback antes de Preview

Si la rama no debe continuar:

```bash
git switch main
git branch -D migration/vercel-supabase
```

Solo hacer esto despues de confirmar que no se necesita conservar la rama local. No hay infraestructura remota que revertir porque no se tocaron servicios productivos.

## Rollback de Vercel Preview

Si ya existe un Preview de Vercel:

1. No promover el deployment.
2. Eliminar o desactivar el Preview desde Vercel si ya no se necesita.
3. Mantener el dominio productivo en Cloudflare.
4. Mantener Supabase staging separado de produccion.
5. Conservar logs y reportes de validacion para diagnostico.

No hay cambio de DNS que revertir en esta fase.

## Rollback de datos staging

Para staging:

1. Detener nuevas pruebas de escritura.
2. Guardar conteos y reportes de `scripts/validate-migrated-data.ts`.
3. Si las migraciones se aplicaron a una base staging desechable, recrear el proyecto o restaurar backup staging.
4. Si la base staging se comparte con otros flujos, aplicar rollback logico tabla por tabla usando los manifests de importacion.
5. No ejecutar rollback destructivo contra produccion.

Los scripts de esta rama son dry-run por defecto. Cualquier ejecucion con `--apply` o `--remote` debe quedar registrada con fecha, proyecto y responsable.

La exposicion temporal del esquema custom en PostgREST puede revertirse solo en
staging con un rol de base autorizado:

```sql
ALTER ROLE authenticator RESET pgrst.db_schemas;
ALTER ROLE authenticator RESET pgrst.db_extra_search_path;
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
```

No ejecutar este bloque en una base compartida sin registrar primero los
consumidores del esquema `recalc_admin`.

## Rollback de Storage staging

1. No borrar buckets productivos R2.
2. En Supabase staging, comparar reporte de `scripts/migrate-r2-to-supabase-storage.ts`.
3. Remover solo objetos creados por el lote de migracion probado.
4. Validar hashes/tamanos antes de borrar objetos duplicados.
5. Mantener R2 como fuente legacy hasta que exista cutover aprobado.

## Rollback de Auth

Antes de produccion:

- Los usuarios productivos siguen autenticando por el sistema actual de Cloudflare/legacy.
- Supabase Auth staging puede descartarse sin afectar produccion.
- No migrar MX, OAuth production callbacks ni dominios productivos hasta tener Preview validado.

Despues de una promocion futura:

1. Retirar el dominio de Vercel o desactivar el alias.
2. Restaurar callbacks del proveedor al dominio Cloudflare previo.
3. Congelar escrituras de usuarios durante la ventana de vuelta.
4. Reconciliar usuarios creados solo en Supabase durante la ventana.

## Rollback despues de cutover futuro

Si en una fase futura se promueve Vercel a produccion:

1. Anunciar ventana de congelamiento de escrituras.
2. Quitar alias/dominio productivo de Vercel.
3. Restaurar DNS a Cloudflare.
4. Rehabilitar Workers y rutas Cloudflare existentes.
5. Comparar conteos de PostgreSQL vs D1 para registros creados durante la ventana.
6. Reinsertar manualmente en Cloudflare los registros faltantes si la produccion vuelve a D1.
7. Mantener Supabase en solo lectura hasta cerrar reconciliacion.

## Archivos legacy

Los artefactos Cloudflare historicos estan aislados en `legacy/cloudflare/` para referencia y rollback:

- `wrangler.jsonc`
- `open-next.config.ts`
- scripts OpenNext/Wrangler
- workflows Cloudflare historicos
- shims Cloudflare no usados por la ruta principal

No ejecutar esos scripts desde esta rama salvo que se este haciendo diagnostico controlado y documentado.

## Rollback de la validacion ejecutada

La importacion de oferta de staging fue revertida desde el panel antes de cerrar
la prueba. Se eliminaron por UUID exacto la sesion, versiones, auditorias,
usuarios, organizaciones, mensajes, objetos y metadata temporales. El estado
final comprobado fue 25 planteles canonicos, 0 programas y 0 ofertas de prueba.

La migracion `20260712204500_grant_service_role_foundation.sql` solo concede
DML a `service_role`; no desactiva RLS ni concede acceso a `anon`. Si se revierte
en staging, usar `REVOKE` sobre las mismas tablas listadas en la migracion y
verificar primero que no existan jobs administrativos que dependan de ella.

Los paneles, webhooks y scripts Neon Auth retirados estan aislados en
`legacy/neon-auth/`. El helper de base Neon retirado esta en
`legacy/neon-database/` junto con sus scripts y workflow manual. Ninguno forma
parte del runtime Vercel ni de `.github/workflows`.
