# Reporte final de migracion Vercel + Supabase

Fecha: 2026-07-12  
Rama: `migration/vercel-supabase`  
Base: `origin/main`  
Estado: lista para revision y Vercel Preview; no lista para cutover productivo.

## Resumen ejecutivo

`apps/web` compila como Next.js estandar y se despliega en Vercel sin OpenNext
ni Wrangler. La ruta principal usa Supabase PostgreSQL, Auth SSR, Realtime
`postgres_changes` y Storage. Cloudflare produccion permanece intacta y los
artefactos historicos estan aislados bajo `legacy/cloudflare/`.

Se reutilizaron App Router, UI, reglas de negocio, paquetes internos y Prisma
como cliente PostgreSQL transitorio. Se retiraron Neon Auth y el driver Neon del
runtime; no hay variables Neon activas en el Preview.

El esquema y RLS se aplicaron solo en Supabase staging. Login, aislamiento por
organizacion, Realtime, Storage, panel administrativo e importacion/rollback de
oferta se validaron con datos temporales que fueron eliminados al terminar.

Pendiente: cargar tarifas y beneficios reales de staging para aprobar el
calculo monetario, y preparar manifests revisados antes de migrar datos D1 u
objetos R2. No se uso informacion productiva.

## Cambios por area

| Area | Cambio | Estado |
| --- | --- | --- |
| Next.js | Build `next build --webpack`, Node runtime y ruta Cloudflare aislada | Completo |
| Base de datos | SQL Supabase versionado, 76 tablas, constraints, seed y RLS | Completo en staging |
| Auth | Clientes browser/server/middleware/admin y cookies SSR | Validado |
| Autorizacion | Roles/capabilities de dominio y RLS multi-organizacion | Validado |
| Realtime | Postgres Changes filtrado, cleanup y reconexion | Validado |
| Storage | Adapter, buckets privados, signed URLs y rutas de archivo | Validado |
| Admin | Panel operativo, permisos y estados de publicacion/rollback | Validado |
| Importaciones | XLSX real, preview, PUBLICAR, transaccion y rollback | Validado |
| Seguridad | Limites ZIP/upload, PII fuera de logs, secrets/dependencies auditados | Validado |
| Cotizador | Oferta importada alimenta selectores reales | Parcial: faltan precios |
| Deployment | Proyecto monorepo, Node 22 y Preview de rama | Validado |
| Pruebas | Unitarias, build, browser, Auth, RLS, Realtime y Storage | Pasa con limites declarados |

## Archivos principales modificados

| Archivo | Cambio | Motivo | Riesgo |
| --- | --- | --- | --- |
| `package.json` | Build Next/Vercel y scripts de migracion | Retirar OpenNext del flujo | Medio |
| `apps/web/middleware.ts` | Refresh y proteccion Supabase SSR | Sesion segura | Alto |
| `apps/web/src/lib/supabase/*` | Clientes separados por contexto | No exponer service role | Alto |
| `apps/web/src/lib/auth/*` | Supabase Auth | Reemplazar Neon Auth | Alto |
| `apps/web/src/lib/cloudflare/runtime.ts` | Compatibilidad PostgreSQL solo local/Vercel | Evitar D1 activo | Medio |
| `apps/web/src/lib/env/*` | Env tipado y referencias publicas estaticas | Bundle/errores claros | Medio |
| `apps/web/src/lib/importers/academic-offer.ts` | Parser por plantel/ciclo y normalizacion | Archivo real del negocio | Alto |
| `apps/web/src/lib/importers/excel-workbook.ts` | Remueve OOXML comments no soportados en memoria | Compatibilidad ExcelJS | Medio |
| `apps/web/src/app/api/admin/import-academic-offer/*` | Limite 10 MB/413 y logs sin email completo | Evitar DoS/PII en observabilidad | Medio |
| `apps/web/src/components/admin/OfferImportClient.tsx` | Flujo y jerarquia UI corregidos | Operacion clara | Bajo |
| `supabase/migrations/20260712195500_*` | Esquema Prisma en PostgreSQL/RLS | Fuente SQL unica | Alto |
| `supabase/migrations/20260712204500_*` | DML fundacional para service role | Admin staging con RLS activo | Medio |
| `scripts/*d1*`, `scripts/*supabase*` | Export/transform/import/validate dry-run | Migracion reanudable | Alto |
| `legacy/cloudflare/`, `legacy/neon-*` | Codigo historico aislado | Rollback/referencia | Bajo |

## Validaciones

| Validacion | Comando | Resultado | Evidencia | Observaciones |
| --- | --- | --- | --- | --- |
| Install | `npm ci --foreground-scripts` | Pasa | 7:04.76; 0 vulnerabilidades | Warnings transitivos documentados |
| Lint | `npm run lint` | Pasa | 1:17.80 | 0 warnings |
| Typecheck | `npm run typecheck` | Pasa | 46.03 s | TypeScript estricto |
| Tests | `npm test -- --reporter=dot` | Pasa | 103 archivos, 400 pruebas | Timeout paralelo descartado al repetir secuencial |
| Build | `npm run build` | Pasa | 5:31.76, 16/16 | Next.js 16.2.6 |
| Security | `npm audit` + secret/RLS/diff review | Pasa | 0 vulnerabilidades, 0 secretos | Limite XLSX corregido y probado |
| Local start | `next start ... --port 3001` | Pasa | Ready 404 ms; smoke 1/1 | Proceso detenido |
| Auth Preview | Playwright smoke | Pasa | 3/3 | Login, recarga, logout, proteccion |
| PostgreSQL/RLS | Supabase staging | Pasa | 76 tablas/RLS, 23 politicas | Dos organizaciones |
| Realtime | Postgres Changes + browser | Pasa | I/U/D, filtro, reconnect, sin duplicados | Presence no probado |
| Storage | SDK + rutas Preview | Pasa | upload/signed/download/delete/RLS | Objetos limpiados |
| Importacion | XLSX real en panel | Pasa | 35 programas, 172 ofertas, rollback | Staging limpio |
| Cotizador monetario | E2E autenticado | Bloqueado por datos | Sin tarifas/beneficios reales | No se inventaron valores |
| Vercel Preview | Deployment de rama | Pasa | alias estable | No promovido |

## Limitaciones

- no se migraron datos D1 ni archivos R2 productivos;
- no se probo el valor monetario sin dataset real de tarifas/beneficios;
- no se probo delivery de magic link/OTP/recovery, Google OAuth ni Presence;
- Prisma y algunos nombres D1/R2 permanecen como compatibilidad interna;
- no se promovio Vercel ni se cambio DNS/dominio productivo.

## Clasificacion de referencias Cloudflare

La busqueda final uso:

```bash
rg -n "cloudflare|wrangler|open-next|opennext|D1|R2|getCloudflareContext|env\.DB|env\.BUCKET"
```

| Categoria | Coincidencias restantes | Clasificacion |
| --- | --- | --- |
| Documentacion/SQL historico | `docs/`, `apps/web/migrations/`, `PUSHLOG.md` | Historia y fuente de mapeo D1 |
| Legacy aislado | `legacy/cloudflare/`, `legacy/neon-*` | No participa en build/runtime |
| Migracion justificada | `scripts/export-d1-data.ts`, `transform-d1-to-postgres.ts`, `migrate-r2-*` | Herramientas dry-run para extraer origen |
| Compatibilidad activa | `apps/web/src/lib/cloudflare/*`, `src/lib/d1/*` | Nombres heredados; en Vercel usan PostgreSQL y el runtime Cloudflare queda deshabilitado |
| Configuracion defensiva | ignores `.open-next`/`.wrangler` en ESLint | Evita analizar artefactos locales; no instala ni ejecuta OpenNext/Wrangler |
| Error pendiente | textos/nombres internos D1/R2 | Refactor de nombres posterior; no hay bindings activos |

No se encontraron `getCloudflareContext`, `env.DB` ni `env.BUCKET` en la ruta
Vercel, y el build principal no invoca Wrangler/OpenNext.

## Riesgos pendientes

| Severidad | Riesgo | Mitigacion |
| --- | --- | --- |
| Critico | Cutover sin reconciliar datos productivos | Bloquear produccion hasta export/import y conteos aprobados |
| Alto | Cotizaciones incorrectas por tarifas faltantes | Importar dataset real staging y aprobar E2E monetario |
| Alto | Diferencias D1/R2 no observadas en manifests | Dry-run, hashes, conteos y rollback por lote |
| Medio | Prisma/adaptadores legacy mantienen deuda | Migracion incremental despues del Preview funcional |
| Medio | Providers Auth no probados | Habilitar y probar solo los requeridos |
| Bajo | Dependencias transitivas deprecated | Actualizacion separada de esta migracion |

## Procedimiento para desplegar staging

1. Usar la rama `migration/vercel-supabase`; no trabajar sobre `main`.
2. Confirmar proyecto Vercel con raiz del monorepo, Node 22,
   `npm ci --foreground-scripts`, `npm run build` y `apps/web/.next`.
3. Configurar variables Preview Supabase; service role y conexiones son
   server-only. No crear variables Neon.
4. Verificar migraciones y aplicar solo staging:

```bash
npx supabase migration list --linked
npx supabase migration up --linked --yes
```

5. Ejecutar scripts D1/Storage primero sin `--apply`; revisar manifests.
6. Desplegar Preview desde la rama y usar su dominio temporal.
7. Configurar `<preview>/auth/callback` en Supabase Auth Redirect URLs.
8. Ejecutar `npm ci`, lint, typecheck, tests, build y E2E autenticado.
9. Cargar tarifas/beneficios staging y repetir el cotizador monetario.
10. No promover, cambiar DNS ni usar credenciales productivas.

## Procedimiento de rollback

Mientras no exista cutover, no promover el Preview y mantener Cloudflare como
ruta productiva. Para datos/Storage staging, revertir por IDs/manifests de lote.
Para PostgREST y Auth consultar `docs/migration-rollback.md`. Reconciliar toda
escritura nueva antes de un rollback futuro posterior a cutover.

## Siguiente paso recomendado

La rama esta:

- lista para revision;
- lista para Vercel Preview;
- tecnicamente lista para preparar una migracion de datos con manifests reales;
- no lista para cutover productivo;
- bloqueada para aprobar el cotizador monetario hasta recibir tarifas y
  beneficios reales de staging.
