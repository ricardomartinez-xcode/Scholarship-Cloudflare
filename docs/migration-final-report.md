# Reporte final de migracion Vercel + Supabase

Fecha: 2026-07-12  
Rama: `migration/vercel-supabase`  
Base: `origin/main`  
Estado: lista para revision tecnica y preparacion de Preview; no lista para cutover productivo.

## Resumen ejecutivo

Se preparo la aplicacion `apps/web` para compilar como Next.js estandar con `next build`, sin OpenNext ni Wrangler en la ruta principal. Se agregaron clientes Supabase SSR/browser/middleware/admin, validacion tipada de variables, migraciones SQL Supabase con RLS, Realtime nativo por `postgres_changes`, Storage por Supabase Storage, scripts dry-run de migracion y documentacion operativa.

Se reutilizo la mayor parte de UI, App Router, paquetes internos, reglas de negocio, Prisma como cliente transitorio y pruebas existentes.

Se elimino la dependencia activa de OpenNext/Wrangler del build y se aislaron artefactos Cloudflare en `legacy/cloudflare/`.

El proyecto Vercel y el endpoint JWKS de Supabase staging ya se verificaron. El
Preview compila Next.js y queda bloqueado al recolectar page data porque falta
`DATABASE_URL`. Tambien queda pendiente terminar el reemplazo de
nombres/repositorios heredados `D1`/`R2` por repositorios PostgreSQL/Supabase
nativos.

## Cambios por area

| Area | Cambio | Estado |
| --- | --- | --- |
| Next.js | `npm run build` apunta a `next build --webpack`; OpenNext queda fuera de la ruta principal. | Implementado |
| Base de datos | `supabase/migrations` contiene fundacion PostgreSQL, RLS, tablas de dominio y buckets; scripts D1 -> Postgres dry-run. | Implementado parcialmente |
| Autenticacion | Supabase Auth SSR, callback `/auth/callback`, middleware con refresh de cookies y clientes separados browser/server/middleware/admin. | Implementado |
| Autorizacion | RLS inicial por usuario, organizacion y rol; tablas de dominio separadas de `auth.users`. | Implementado parcialmente; requiere validacion remota |
| Realtime | Reemplazo del puente outbox/broadcast por suscripciones `postgres_changes` para mensajes persistentes. | Implementado; requiere staging |
| Storage | Adapter Supabase Storage, rutas de upload/signed URL y migracion R2 -> Storage dry-run. | Implementado; requiere staging |
| Deployment | `vercel.json`, `scripts/vercel-build.sh`, env examples y README actualizados para Vercel Preview. | Implementado |
| Pruebas | Tests Vitest actualizados para Auth/Env/Realtime/Storage y regresiones. | Local pasa |

## Archivos principales modificados

| Archivo | Cambio | Motivo | Riesgo |
| --- | --- | --- | --- |
| `package.json` | Build default a Next.js, scripts de migracion, remocion de ruta Cloudflare activa. | Vercel/Next estandar. | Medio |
| `apps/web/package.json` | `build` ejecuta `typecheck` y luego `next build`. | Evitar OOM por validacion interna duplicada de Next. | Bajo |
| `apps/web/next.config.ts` | Sin aliases Cloudflare; Sentry plugin condicional; skip interno de typecheck solo tras `tsc`. | Build Vercel estable. | Medio |
| `apps/web/middleware.ts` | Middleware Supabase SSR. | Refresh seguro de sesion/cookies. | Alto |
| `apps/web/src/lib/supabase/*` | Clientes browser/server/middleware/admin. | Evitar duplicacion y secretos en cliente. | Alto |
| `apps/web/src/lib/auth/*` | Auth migrado a Supabase. | Reemplazar Neon/Cloudflare auth. | Alto |
| `apps/web/src/lib/cloudflare/d1.ts` | Adaptador PostgreSQL-compatible para call sites D1 heredados. | Mantener UI/reglas sin Worker/D1. | Alto |
| `apps/web/src/lib/cloudflare/runtime.ts` | Alias historico activa la ruta PostgreSQL-compatible en Vercel o con `POSTGRES_COMPAT_RUNTIME=1`. | Evitar que Vercel deshabilite flujos heredados sin romper tests locales. | Medio |
| `supabase/migrations/20260710204000_recalc_admin_core.sql` | Esquema, RLS, buckets y politicas Storage. | Fuente SQL Supabase. | Alto |
| `supabase/migrations/20260710211500_realtime_postgres_changes.sql` | Publicacion Realtime para tablas persistentes. | Supabase Realtime nativo. | Medio |
| `scripts/export-d1-data.ts` | Export D1 dry-run por defecto. | Preparar migracion sin tocar produccion. | Medio |
| `scripts/transform-d1-to-postgres.ts` | Transformaciones D1 -> PostgreSQL. | Migracion de datos staging. | Medio |
| `scripts/import-supabase-data.ts` | Import staging dry-run por defecto. | Carga controlada. | Alto |
| `scripts/validate-migrated-data.ts` | Conteos locales/remotos; tolera JSONL ausente con 0 filas. | Validacion reproducible. | Bajo |
| `scripts/migrate-r2-to-supabase-storage.ts` | Migracion Storage dry-run. | Reemplazar R2 con Supabase Storage. | Medio |
| `legacy/cloudflare/` | Config/scripts/workflows/shims Cloudflare aislados. | Rollback y referencia historica. | Bajo |

## Validaciones

| Validacion | Comando | Resultado | Evidencia | Observaciones |
| --- | --- | --- | --- | --- |
| install | `npm ci --foreground-scripts` | Pasa | `duration=3:34.72 exit=0` | Warnings deprecated; Prisma Client generado. |
| lint | `npm run lint` | Pasa | `duration=1:02.24 exit=0` | Sin warnings permitidos. |
| typecheck | `npm run typecheck` | Pasa | `duration=0:14.35 exit=0` | TypeScript repo. |
| test | `npm test` | Pasa | `97 passed`, `376 passed`, `duration=0:25.97 exit=0` | Vitest. |
| build | `npm run build` | Pasa | `Compiled successfully`, `16/16 static pages`, `duration=4:06.82 exit=0` | Next.js 16.2.6 webpack. |
| start local | `npm run start` con placeholders | Pasa | `/`, `/legal/privacy`, `/auth/sign-in` devuelven 200 | Sin credenciales reales. |
| export dry-run | `npm run migration:export-d1` | Pasa | imprime `wrangler d1 execute` en dry-run | No ejecuta remoto. |
| transform dry-run | `npm run migration:transform-d1` | Pasa | mapea 8 tablas, omite `outbox_event` | No escribe datos. |
| import dry-run | `npm run migration:import-supabase` | Pasa | 0 filas por manifiesto dry-run | No escribe Supabase. |
| validate local | `npm run migration:validate-data` | Pasa | `[local:ok]` para todas las tablas | Remoto omitido. |
| storage dry-run | `npm run migration:migrate-storage` | Pasa | reporte vacio al no existir manifest R2 | No escribe Supabase. |
| Supabase JWKS | `curl` al endpoint publico | Pasa | ES256/P-256 y `kid` esperado | No equivale a credenciales de API o DB. |
| Vercel project | Vercel CLI/API | Pasa | Next.js, Node 22, monorepo y GitHub verificados | Sin dominio productivo agregado. |
| Vercel Preview | `vercel deploy` sin `--prod` | Bloqueado | Next compila en 63s; `DATABASE_URL is not set` | Preview no queda navegable. |

## Limitaciones

- No hay Supabase CLI local: `supabase: command not found`.
- El acceso Vercel esta configurado, pero Supabase solo cuenta con URL/JWKS
  publico. Faltan publishable/anon key, `DATABASE_URL`, `DIRECT_URL`, service
  role para operaciones administrativas y access token para configurar/aplicar
  cambios mediante Management API/CLI.
- No se aplicaron migraciones remotas.
- Se ejecuto Vercel Preview, pero fallo antes de quedar `READY` por la ausencia
  de `DATABASE_URL`.
- No se valido login real, refresh real, RLS remoto, Realtime real ni Storage real.
- Persisten nombres internos `D1`/`R2` en helpers de compatibilidad, tests y columnas legacy como `r2Key`.
- Algunas rutas siguen usando Prisma/adaptador compatible en vez de repositorios Supabase/Postgres nativos.
- Workflows historicos de Neon/GitHub siguen en el repo y deben revisarse antes de activar automatizaciones de deployment.

## Riesgos pendientes

| Severidad | Riesgo | Mitigacion |
| --- | --- | --- |
| Critico | Promover sin validar Supabase Auth/RLS en staging. | Bloquear cutover hasta pruebas reales con usuarios/organizaciones/roles. |
| Alto | Divergencia entre esquema Supabase nuevo y tablas legacy usadas por Prisma/adaptador. | Inventario tabla por tabla y migracion incremental de repositorios a SQL PostgreSQL final. |
| Alto | Upload/Realtime no probados contra Supabase staging. | Ejecutar suite manual/E2E en Preview con buckets y publication configurados. |
| Medio | Nombres `D1`/`R2` pueden confundir mantenimiento. | Refactor posterior de nombres internos y tests tras Preview funcional. |
| Medio | Build depende de skip interno de typecheck de Next para evitar OOM. | Mantener `npm run typecheck` obligatorio antes de `next build`; monitorear memoria en Vercel. |
| Bajo | Warnings deprecated transitivos. | Planificar actualizacion de dependencias fuera de esta migracion. |

## Procedimiento para desplegar staging

1. Crear proyecto Supabase staging.
2. Configurar variables Preview en Vercel:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` solo server-side
   - `POSTGRES_COMPAT_RUNTIME` solo para smoke local si no corre en Vercel
3. Aplicar migraciones a staging:

```bash
supabase db push --project-ref <staging-ref>
```

4. Cargar datos staging:

```bash
npm run migration:export-d1 -- --execute --database=<staging-or-reviewed-source>
npm run migration:transform-d1 -- --input=artifacts/d1-export
npm run migration:import-supabase -- --apply
npm run migration:validate-data -- --remote
```

5. Migrar archivos staging:

```bash
npm run migration:migrate-storage -- --manifest=artifacts/r2-storage-export/manifest.json --apply
```

6. Crear Vercel Preview desde `migration/vercel-supabase`.
7. Configurar Supabase Auth URLs:
   - Site URL: Preview URL
   - Redirect URL: `<preview-url>/auth/callback`
   - Local URL: `http://127.0.0.1:3000/auth/callback`
8. Validar login, ruta protegida, lectura/escritura, Realtime y Storage.

## Procedimiento de rollback

Usar `docs/migration-rollback.md`. Mientras no haya cutover, el rollback principal es no promover el Preview y mantener Cloudflare como produccion activa.

## Siguiente paso recomendado

La rama esta:

- lista para revision tecnica;
- proyecto Vercel configurado y rama Preview aislada;
- bloqueada para completar el Preview hasta recibir credenciales Supabase staging;
- no lista para migracion de datos productiva;
- no lista para cutover productivo.
