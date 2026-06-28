# Migracion integral a Cloudflare

Fecha: 2026-06-28

Rama auditada: `codex/cloudflare-migration-audit-plan`

## Alcance y evidencia local

Este plan se basa en inspeccion estatica del repositorio y en lectura de configuracion local versionada. No se ejecutaron migraciones remotas, importaciones, escrituras de datos, rotacion de secretos ni despliegues de produccion.

El conector Cloudflare se intento usar solo para listar metadatos D1/R2, pero respondio `Unexpected response type`. Por esa razon este documento no declara como verificado el estado remoto de D1, R2, dominios ni despliegues; cualquier evidencia remota debe salir del workflow READONLY o de Wrangler autenticado con autorizacion humana.

Evidencia usada:

- `package.json`, `apps/web/package.json`, `apps/web/wrangler.jsonc`.
- Workflows en `.github/workflows`.
- Migraciones D1 locales en `apps/web/migrations`.
- Capa D1 existente en `apps/web/src/lib/d1`.
- Adaptadores Cloudflare existentes en `apps/web/src/lib/cloudflare`.
- Busquedas `rg` sobre `@prisma/client`, `prisma`, `@neondatabase`, `DATABASE_URL`, `NEON`, `@supabase`, `SUPABASE`, `vercel`, `VERCEL`, `nodemailer`, `fs`, `path`, `child_process`, `net`, `tls` y `worker_threads`.

Conteos relevantes:

| Categoria | Evidencia |
| --- | --- |
| Archivos fuente runtime con Prisma o `@/lib/prisma` | 247 |
| Archivos fuente runtime con Neon, Neon Auth o URLs DB | 11 |
| Archivos fuente runtime con Supabase/realtime | 26 |
| Scripts/workflows/manifests con Prisma, Neon, Supabase o Vercel | 26 |
| Archivos fuente runtime con imports Node-only revisados | 3 |
| Archivos fuente runtime con correo, push, R2 o Cloudinary | 24 |
| `route.ts` en `apps/web/src/app` | 200 |
| Rutas API bajo `apps/web/src/app/api` | 185 |
| Server Actions | 19 |
| Rutas con `export const runtime = "nodejs"` | 115 |

## Estado actual resumido

El repositorio ya tiene una base parcial de Cloudflare:

- OpenNext se construye con `@opennextjs/cloudflare`.
- `apps/web/wrangler.jsonc` apunta al Worker `scholarship-cloudflare`.
- Existe binding D1 `DB` hacia `recalc-cloudflare`.
- Existe binding R2 `Assets` hacia bucket `recalc`.
- Hay repositorios D1 iniciales en `apps/web/src/lib/d1` para usuarios, organizaciones, cotizaciones, ofertas academicas, import jobs, Google OAuth, conversaciones, outbox, auditoria y rate limiting de auth.

El runtime productivo todavia depende de compatibilidad legacy:

- `@/lib/prisma` reexporta `@relead/db`.
- `packages/db/src/client.ts` crea un `PrismaClient` global.
- `apps/web/next.config.ts` usa aliases de build Cloudflare para reemplazar `@prisma/client`, Neon Auth, Supabase y Sentry.
- `apps/web/src/lib/cloudflare/prisma.ts` aun exporta `new PrismaClient()`, lo que no debe ser ruta final Worker.
- Neon Auth sigue siendo fuente de autenticacion.
- Supabase sigue soportando realtime/broadcast en inbox y capacitacion.
- Nodemailer sigue siendo el adaptador de correo.
- Vercel permanece en `vercel.json`, `scripts/vercel-build.sh` y workflows legacy.

## Estado seguro verificado para PR 1

Este PR no migra datos ni aplica migraciones. La auditoria confirmo que el flujo versionado de Cloudflare ya respeta la regla operativa base:

1. `quality-release-gate` corre antes del preflight.
2. `Cloudflare Preflight` construye OpenNext, prepara bundle, genera checksum y sube artifact por un dia.
3. `Deploy Cloudflare Worker` se dispara solo si preflight en `main` fue exitoso y reutiliza el artifact validado.
4. El deploy Worker no ejecuta `wrangler d1 migrations apply`.
5. `.github/workflows/cloudflare-d1-migrations.yml` es manual, limitado a `main` y requiere confirmacion literal `APLICAR`.
6. `.github/workflows/d1-migration-readiness.yml` es manual, requiere `READONLY`, captura evidencia y no aplica SQL remoto.

Los cambios de este PR son principalmente documentales: plan, inventario, riesgos, rollback y autorizaciones pendientes. Tambien se retiraron dos helpers Cloudflare sin uso para que `npm run lint` pueda pasar con `--max-warnings=0`.

## Inventario de dependencias legacy

| Dependencia | Uso actual | Riesgo | Destino Cloudflare |
| --- | --- | --- | --- |
| Vercel | `vercel.json`, `scripts/vercel-build.sh`, workflows legacy, dominios historicos en tests | Puede seguir ejecutando build Prisma/Neon o crear rutas mentales de deploy fuera de Cloudflare | GitHub Actions + Workers deploy |
| Prisma | Modelos, enums, queries, transacciones, imports en rutas y servicios | Prisma Client no es la ruta final para Workers; global connections y SQL Postgres bloquean D1 | Repositorios D1 por dominio, tipos compartidos sin Prisma runtime |
| Neon | DB URL, Neon serverless driver, Neon Auth, scripts de seed/verify/admin | Mantiene dependencia externa critica en auth y datos | D1 para datos, auth propia compatible Workers o adapter externo justificado |
| Supabase | Realtime browser/server, broadcast de inbox/capacitacion, config/migration | SDK y broadcast externo no son final Cloudflare | Durable Objects solo si se confirma realtime compartido; si no, polling seguro + D1/outbox |
| Nodemailer/SMTP | Envio de correos transaccionales | Node adapter puede no ser compatible con Worker final | Cloudflare Email Workers/Send Email o adapter HTTP compatible Workers |
| Node `fs/path/child_process` | Scripts, build, algunos servicios admin/import | No disponible como ruta final Worker de request salvo compatibilidad Node habilitada y validada | Mantener en scripts/build; refactorizar rutas productivas a R2/D1/Web APIs |

## Inventario funcional

| Area | Estado local | Destino |
| --- | --- | --- |
| Cotizacion | D1 parcial en `apps/web/src/lib/d1/quotes.ts`; rutas y servicios aun usan Prisma en `quote-history`, `scholarship-quote-service`, `pricing-options` | D1 repositories para sesiones, escenarios, reglas, pricing snapshots y eventos |
| Precios | Importadores y admin usan Prisma en actions/rutas | D1 repository de precios, imports idempotentes, outbox |
| Becas | `additional-benefits`, `base-scholarships`, benefits admin/public siguen en Prisma | D1 repository de becas y reglas |
| Ofertas academicas | D1 read parcial en `listD1AcademicOffers`; admin/import aun Prisma | Completar writes, status, imports y validaciones D1 |
| Administracion financiera | Fees/costos usan Prisma | D1 repository de costos/fees |
| Autenticacion | Neon Auth y tablas `cloudflare_auth_*` coexisten | Resolver sesion/cookies/hash/rate-limit en D1 y secrets Workers |
| Archivos | R2 existe, pero metadatos aun se consultan/escriben con Prisma en muchas rutas | R2 binding + D1 file metadata + signed URLs privadas |
| Importaciones | Import jobs D1 inicial, pero importadores reales aun Prisma | D1 job ledger + Queues + dry-run/reconciliacion |
| Webhooks | Neon Auth, Meta webhook y admin Neon webhook | Adapters HTTP Workers, idempotency D1, outbox |
| Realtime | Supabase Realtime en inbox/capacitacion | Validar si requiere Durable Objects; no agregar DO sin evidencia |
| Correos | Nodemailer SMTP | Adapter HTTP/Cloudflare Email con secrets |
| Cron/jobs | Workflows GitHub y scripts manuales; no se detecto cron Worker productivo | GitHub Actions o Queues/Cron Triggers segun caso |

## Migraciones D1

Orden local que usaria Wrangler por nombre:

1. `0001_recalc_core.sql`
2. `0002_cloudflare_auth_user_fields.sql`
3. `0003_extension_session_tokens.sql`
4. `0003_organizations_and_audit.sql`
5. `0004_extension_runtime_and_quote.sql`
6. `0004_quote_history.sql`
7. `0005_import_jobs.sql`
8. `0006_google_oauth_and_sync.sql`
9. `0007_conversations_and_webhooks.sql`
10. `0008_idempotency_and_outbox.sql`
11. `0009_google_oauth_state.sql`
12. `0010_cloudflare_auth_rate_limit.sql`

Prefijos duplicados:

- `0003`: `0003_extension_session_tokens.sql`, `0003_organizations_and_audit.sql`.
- `0004`: `0004_extension_runtime_and_quote.sql`, `0004_quote_history.sql`.

Regla para fases siguientes: no renombrar ni modificar migraciones historicas. Las migraciones nuevas deben usar el siguiente prefijo posterior al maximo existente (`0011_*` o superior), despues de comparar contra `wrangler d1 migrations list recalc-cloudflare --remote` en auditoria READONLY.

## Mapeo hacia Cloudflare

| Necesidad | Implementacion objetivo | Notas |
| --- | --- | --- |
| Runtime Next.js | Cloudflare Workers + OpenNext | Mantener `nodejs_compat` solo mientras haya dependencias legacy justificadas |
| SQL relacional | D1 binding `DB` | Evitar binding duplicado `MYSQL` salvo compat temporal documentada |
| Archivos | R2 binding `Assets` + D1 metadata | No URLs publicas permanentes para privados |
| Async/importaciones | D1 job ledger + Queues | Reintentos, idempotencia, dead-letter y reconciliacion |
| Realtime/coordinacion | Durable Objects solo si el analisis lo exige | Supabase Realtime debe aislarse como temporal |
| Cache/config no relacional | KV solo si aporta valor medible | No agregar KV por defecto |
| Correos | Adapter compatible Workers | Cloudflare Email o proveedor HTTP |
| CI/CD | GitHub Actions | Quality gate, Cloudflare preflight, artifact reuse, deploy Worker |

## Primera fase de codigo segura

Para esta primera entrega no se cambio comportamiento runtime. La unica limpieza de codigo fue retirar helpers sin uso detectados por lint en `apps/web/src/lib/cloudflare/auth.ts` y `apps/web/src/lib/cloudflare/extension-runtime-d1.ts`. La primera fase de codigo funcional queda delimitada para el siguiente PR:

1. Crear interfaces de repositorio para cotizacion/precios/becas sin cambiar contratos HTTP.
2. Hacer que `POST /api/data/quote` deje de declarar `runtime = "nodejs"` solo despues de que sus dependencias directas usen D1 o adapters compatibles Workers.
3. Sustituir el alias `@/lib/prisma` en build Cloudflare por un facade D1 real, no por `new PrismaClient()`.
4. Agregar pruebas unitarias de repositorios D1 antes de conectar rutas productivas.

## Orden recomendado de migracion

### Fase 1: Auditoria y guardrails

Objetivo: dejar evidencia versionada y remover riesgos operativos obvios sin tocar datos.

Tareas:

- Mantener `docs/cloudflare-runtime-inventory.md`.
- Mantener este plan.
- Mantener D1 migrations fuera del deploy automatico.
- Crear/fortalecer auditoria READONLY con evidencia descargable.
- Documentar workflows legacy antes de retirarlos.

Criterios de aceptacion:

- El deploy Worker no ejecuta `wrangler d1 migrations apply`.
- El workflow manual de migraciones requiere `APLICAR`.
- Las busquedas legacy son reproducibles.
- No hay datos remotos modificados.

Rollback:

- Revertir solo el workflow manual D1 y los documentos de este PR.
- No se requiere rollback de datos porque no hay escrituras remotas.

### Fase 2: Capa de datos D1

Objetivo: que rutas y servicios de prioridad alta usen repositorios D1, no Prisma/Neon/Supabase directos.

Orden:

1. Cotizacion.
2. Precios.
3. Becas.
4. Ofertas academicas.
5. Administracion financiera.
6. Autenticacion.
7. Importaciones.
8. Procesos admin.

Criterios de aceptacion:

- Cada dominio tiene interfaces de repositorio y adapter D1.
- Las rutas productivas no importan `@/lib/prisma`, `@prisma/client`, `@neondatabase/*` o `@supabase/*`.
- Las queries D1 usan `prepare().bind()`.
- Los adapters legacy quedan aislados, marcados como temporales y fuera de la ruta final Cloudflare.
- Hay pruebas unitarias de repositorios D1 con fixtures locales.

Rollback:

- Mantener una bandera o wiring reversible por dominio hasta completar validacion.
- Revertir dominio por dominio; no mezclar refactors masivos.

### Fase 3: D1, auditoria e importacion

Objetivo: que el estado D1 sea reproducible, auditable e importable sin writes accidentales.

Tareas:

- Crear auditoria manual READONLY que capture manifest local, prefijos duplicados, migraciones remotas, tablas, schema, `PRAGMA foreign_key_check`, conteos por tabla y errores por tabla.
- Crear validacion local sobre base D1 limpia.
- Crear importadores dry-run con conteos antes/despues, errores, reintentos, idempotencia y reconciliacion por claves estables.

Criterios de aceptacion:

- La auditoria no falla completa cuando una tabla falta; marca `present` o `missing_or_unqueryable`.
- Ninguna importacion real corre sin autorizacion explicita.
- Migraciones nuevas empiezan en `0011_*` o superior.

Rollback:

- Documentar restore point/export antes de cualquier write remoto autorizado.
- Cada import debe tener reporte de reconciliacion y procedimiento de revert.

### Fase 4: Archivos, async y servicios externos

Objetivo: reemplazar almacenamiento/procesos legacy por R2, D1 y Queues donde corresponde.

Criterios de aceptacion:

- Archivos privados usan R2 con URLs firmadas o proxy autenticado.
- Metadata vive en D1.
- Importaciones usan Queues o un mecanismo Cloudflare equivalente seguro.
- Google, Meta, WhatsApp y correo usan interfaces/adapters compatibles Workers.
- Durable Objects solo existe si hay decision documentada.

Rollback:

- Mantener compat temporal de lectura para archivos existentes.
- No borrar buckets, objetos ni recursos externos sin autorizacion humana.

### Fase 5: CI/CD y configuracion

Objetivo: estabilizar `quality gate -> preflight -> deploy Worker`.

Criterios de aceptacion:

- El artifact desplegado fue preparado en preflight.
- Checks verifican bindings requeridos, size del Worker y YAML.
- Migraciones D1 siguen fuera del deploy automatico.
- Workflows legacy retirados solo despues de documentar reemplazo.

Rollback:

- Revertir workflow por PR.
- Mantener workflow manual D1 separado.

### Fase 6: Limpieza legacy

Objetivo: retirar dependencias no usadas solo despues de reemplazos funcionales.

Criterios de aceptacion:

- `rg` no encuentra imports productivos directos de Prisma, Neon, Supabase ni Vercel.
- `package.json` elimina dependencias legacy solo cuando no existan referencias.
- Variables legacy estan documentadas como retiradas o temporales.
- No se elimina infraestructura remota.

Rollback:

- Cada retiro debe tener commit pequeño y pruebas enfocadas.
- Restaurar dependencia/import si una ruta validada falla.

## Riesgos y bloqueadores

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Prisma muy extendido | Alto esfuerzo de refactor y riesgo de regresion | Migrar por dominio, con repositorios y pruebas |
| Neon Auth activo | Auth es superficie critica | Diseñar reemplazo D1 antes de cortar Neon |
| Supabase Realtime en UX activa | Puede romper inbox/capacitacion | Medir necesidad real de realtime antes de Durable Objects |
| Migraciones D1 con prefijos duplicados | Incertidumbre contra estado remoto | Auditoria READONLY antes de nuevas migraciones |
| R2 con rutas publicas/defaults historicos | Riesgo de privacidad | Revisar politica por tipo de archivo |
| Node-only APIs | Build puede compilar pero fallar en Worker | Inventario continuo y pruebas Cloudflare |
| Workflows legacy | Pueden seguir mutando Neon/Vercel | Documentar reemplazo y retirar por PR |

## Acciones que requieren autorizacion humana

- Ejecutar `wrangler d1 migrations apply` en remoto.
- Ejecutar auditoria remota READONLY si requiere tokens no disponibles localmente.
- Importar datos desde Neon, Supabase u otra fuente.
- Borrar, renombrar o modificar migraciones historicas.
- Rotar, leer o modificar secretos.
- Eliminar recursos remotos de Vercel, Neon, Supabase o Cloudflare.
- Cambiar proveedor de auth o OAuth productivo.
- Hacer cutover de dominio productivo.
- Desplegar manualmente a produccion fuera del pipeline acordado.
- Borrar dependencias legacy despues de confirmar que no existen rutas productivas activas.

## Pruebas requeridas por fase

Base por PR:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build:cloudflare`

Adicionales cuando aplique:

- Validacion local D1 limpia.
- Pruebas de repositorios D1.
- Smoke tests de rutas criticas.
- Busqueda de imports incompatibles con Workers.
- Revision de tamano final Worker.
- Revision de secretos expuestos en codigo/workflows.
- Validacion YAML de workflows modificados.
- Validacion de scripts shell modificados.
