# Inventario de runtime Cloudflare

Fecha: 2026-06-28

Rama auditada: `codex/cloudflare-d1-r2-worker-runtime`

## Alcance

Inventario estatico de dependencias legacy y APIs incompatibles con Cloudflare Workers. No se consultaron datos remotos ni secretos.

Comandos base usados:

```powershell
rg -n -S '@prisma/client|\bprisma\b|@neondatabase|DATABASE_URL|\bNEON\b|@supabase|\bSUPABASE\b|\bvercel\b|\bVERCEL\b|nodemailer|child_process|worker_threads|from ["'']node:(fs|path|net|tls)|from ["''](fs|path|net|tls)|require\(["''](fs|path|net|tls)' apps packages scripts .github supabase package.json apps/web/package.json vercel.json --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/.open-next/**' --glob '!**/dist/**'
rg --files apps/web/src/app | rg '(route|actions)\.(ts|tsx)$'
rg --files apps packages scripts .github supabase | rg -i '(webhook|cron|schedule|queue|outbox|realtime|socket|poll|auth|file|upload|download|mail|email|import|export|d1|r2|wrangler|vercel|neon|supabase|prisma)'
```

Conteos:

| Categoria | Conteo |
| --- | ---: |
| Archivos con senales legacy/Node-only en busqueda global | 338 |
| Archivos runtime con Prisma o `@/lib/prisma` | 243 |
| Archivos con Neon, Neon Auth o `DATABASE_URL` | 38 |
| Archivos con Supabase o `SUPABASE_*` | 16 |
| Archivos runtime/scripts con Node-only APIs revisadas | 20 |
| `route.ts` en `apps/web/src/app` | 200 |
| `route.ts` bajo `apps/web/src/app/api` | 185 |
| Server Actions | 19 |
| Rutas/archivos de importacion | 38 |
| Rutas/archivos de archivos/upload/download/signed URLs | 16 |
| Webhook routes | 3 |

## Orden local de migraciones D1

| Orden | Archivo |
| ---: | --- |
| 1 | `apps/web/migrations/0001_recalc_core.sql` |
| 2 | `apps/web/migrations/0002_cloudflare_auth_user_fields.sql` |
| 3 | `apps/web/migrations/0003_extension_session_tokens.sql` |
| 4 | `apps/web/migrations/0003_organizations_and_audit.sql` |
| 5 | `apps/web/migrations/0004_extension_runtime_and_quote.sql` |
| 6 | `apps/web/migrations/0004_quote_history.sql` |
| 7 | `apps/web/migrations/0005_import_jobs.sql` |
| 8 | `apps/web/migrations/0006_google_oauth_and_sync.sql` |
| 9 | `apps/web/migrations/0007_conversations_and_webhooks.sql` |
| 10 | `apps/web/migrations/0008_idempotency_and_outbox.sql` |
| 11 | `apps/web/migrations/0009_google_oauth_state.sql` |
| 12 | `apps/web/migrations/0010_cloudflare_auth_rate_limit.sql` |

Prefijos duplicados:

- `0003`: `0003_extension_session_tokens.sql`, `0003_organizations_and_audit.sql`.
- `0004`: `0004_extension_runtime_and_quote.sql`, `0004_quote_history.sql`.

No se ejecuto `wrangler d1 migrations list recalc-cloudflare --remote`; queda pendiente para auditoria READONLY.

## Matriz principal

| Archivo | Dependencia/API | Uso actual | Riesgo en Workers | Destino Cloudflare | Prioridad | Accion |
| --- | --- | --- | --- | --- | --- | --- |
| `package.json` | Prisma, Neon, Supabase, Nodemailer, Vercel script | Dependencias y scripts legacy siguen instalados | Bundle y rutas pueden conservar runtime externo | D1/R2/Queues/adapters Workers | Alta | temporal |
| `apps/web/package.json` | `wrangler d1 migrations apply`, deploy Cloudflare | Scripts manuales D1 y deploy | Si se invoca en deploy aplica migraciones remotas | Workflow manual protegido | Alta | temporal |
| `.github/workflows/cloudflare-workers.yml` | Wrangler deploy | Deploy Worker por `workflow_run` desde `Cloudflare Preflight` | Si se modifica, puede romper artifact/checksum o deploy protegido | Mantener deploy sin D1 writes | Alta | mantener |
| `.github/workflows/cloudflare-d1-migrations.yml` | Wrangler D1 remote apply | Workflow manual nuevo | Puede escribir remoto si operador confirma | Confirmacion `APLICAR` + environment | Alta | mantener |
| `.github/workflows/cleanup-academic-offer-neon.yml` | `DATABASE_URL`, Neon | Limpieza academica legacy | Escribe en DB externa si se dispara | Reconciliador D1 dry-run/manual | Alta | temporal |
| `.github/workflows/fix-vercel-campus-catalog.yml` | Vercel/Prisma patch | Workflow correctivo legacy | Puede reintroducir flujo Vercel/Prisma | Documentar reemplazo y retirar | Media | retirar |
| `.github/workflows/quality-release-gate.yml` | Release gate | Lint/test/build/e2e via script | Necesario para deploy, no Worker-specific | Mantener como gate previo | Alta | mantener |
| `vercel.json` | Vercel | Build command legacy | Mantiene ruta de despliegue no objetivo | GitHub Actions + Workers | Media | temporal |
| `scripts/vercel-build.sh` | Vercel, Neon, Prisma migrate | Build Vercel con DB URL | Runtime/deploy externo a objetivo | Retiro despues de cutover | Alta | temporal |
| `apps/web/wrangler.jsonc` | D1 `DB`, D1 `MYSQL`, R2 `Assets`, Workers | Config Worker | Binding `MYSQL` duplica DB y puede confundir ownership | Binding unico DB + R2 claro | Alta | refactorizar |
| `apps/web/next.config.ts` | Cloudflare shims, Node `path` | Aliases para compilar OpenNext | Oculta deuda de Prisma/Neon/Supabase | Remover shims al migrar rutas | Alta | temporal |
| `apps/web/src/lib/prisma.ts` | `@relead/db` | Reexport Prisma global | Import directo de DB externa | Repositories D1 por dominio | Alta | refactorizar |
| `packages/db/src/client.ts` | `PrismaClient`, globalThis cache | Cliente Prisma global | Conexion global incompatible con ruta final Worker | Adapter legacy aislado fuera de Worker | Alta | temporal |
| `packages/db/src/db-url.ts` | `DATABASE_URL`, `DIRECT_URL`, `VERCEL` | Resolucion URL Postgres | Dependencia de Neon/Vercel | Secrets Cloudflare solo donde aplique | Alta | retirar |
| `apps/web/src/lib/cloudflare/prisma.ts` | `PrismaClient` | Alias de `@/lib/prisma` en build Cloudflare | No debe existir Prisma runtime final en Worker | D1 repository facade | Alta | refactorizar |
| `apps/web/src/lib/cloudflare/shims/prisma-client.ts` | Prisma shim | Proxy para compilar | Puede esconder imports productivos | Eliminar cuando rutas usen D1 | Alta | temporal |
| `apps/web/src/lib/cloudflare/shims/neon-auth-server.ts` | Neon Auth shim | Compat de build | Auth externa no resuelta | Auth compatible Workers/D1 | Alta | temporal |
| `apps/web/src/lib/cloudflare/shims/supabase.ts` | Supabase shim | Compat de build server | Realtime externo sigue pendiente | DO/adapter realtime si se justifica | Media | temporal |
| `apps/web/src/lib/neon.ts` | `@neondatabase/serverless` | Cliente SQL Neon | DB externa en runtime | D1 repositories | Alta | refactorizar |
| `apps/web/src/lib/auth/server.ts` | `@neondatabase/auth/next/server` | Auth server | Dependencia Neon Auth | Auth D1/Workers | Alta | refactorizar |
| `apps/web/src/lib/auth/client.ts` | `@neondatabase/auth/next` | Auth browser/client | Dependencia Neon Auth | Adapter auth objetivo | Alta | refactorizar |
| `apps/web/src/lib/neon-auth-admin.ts` | `NEON_API_KEY`, Neon Auth config | Admin de Neon Auth | Requiere secretos Neon y API externa | Retirar al cortar Neon Auth | Media | temporal |
| `apps/web/src/app/api/integrations/neon-auth/webhook/route.ts` | Neon Auth webhook | Webhook legacy | Acopla eventos auth externos | Webhook adapter o retiro | Alta | temporal |
| `apps/web/src/app/api/admin/integrations/neon-auth/status/route.ts` | Neon Auth admin | Estado integracion | Admin externo a objetivo | Retiro/documentacion | Media | temporal |
| `apps/web/src/components/admin/NeonAuthIntegrationPanel.tsx` | Neon Auth UI/config | Panel admin | Expone flujo operativo Neon | Retirar tras reemplazo auth | Media | temporal |
| `apps/web/src/lib/supabase/client.ts` | `@supabase/supabase-js` | Realtime browser | Proveedor externo realtime | DO solo si requerido | Media | refactorizar |
| `apps/web/src/lib/supabase/server-realtime.ts` | Supabase REST broadcast | Broadcast servidor | Requiere service role y endpoint externo | Outbox + DO/Queues segun necesidad | Media | refactorizar |
| `packages/realtime/src/supabase-browser-client.ts` | Supabase SDK | Cliente realtime compartido | Reexporta dependencia externa | Adapter realtime abstracto | Media | refactorizar |
| `packages/realtime/src/messaging-service.ts` | Supabase broadcast | Mensajeria inbox | Realtime externo | D1 outbox + DO si aplica | Media | refactorizar |
| `apps/web/src/hooks/useRealtimePresence.ts` | Supabase realtime | Presencia UI | Necesita canal externo | DO si presencia real es necesaria | Media | refactorizar |
| `apps/web/src/hooks/useRealtimeMessages.ts` | Supabase realtime | Mensajes UI | Necesita canal externo | DO o polling seguro | Media | refactorizar |
| `apps/web/src/app/api/unidep/inbox/threads/[threadId]/messages/route.ts` | Supabase broadcast | Emite mensajes | External realtime en ruta API | D1 outbox + adapter Worker | Media | refactorizar |
| `apps/web/src/app/api/capacitacion/messages/route.ts` | Supabase broadcast | Mensajes capacitacion | External realtime | D1 outbox + adapter Worker | Media | refactorizar |
| `apps/web/src/lib/mailer.ts` | `nodemailer` | SMTP transaccional | Node adapter no final Worker | Email Workers/proveedor HTTP | Alta | refactorizar |
| `apps/web/src/lib/admin-system-control.ts` | `node:fs`, `node:path`, env checks | Lee estado/config local | No debe correr como ruta Worker productiva con fs | Separar diagnostics local/admin safe | Media | refactorizar |
| `apps/web/src/app/api/admin/import-academic-offer/route.ts` | `node:fs`, Prisma | Importacion admin | FS local y DB externa | R2 upload + D1 import job | Alta | refactorizar |
| `apps/web/src/lib/importers/academic-offer.ts` | `node:fs`, `node:path`, Prisma | Parse/import oferta | FS y Prisma | Parser puro + D1 repository | Alta | refactorizar |
| `apps/web/src/lib/importers/prices-csv.ts` | Prisma | Import prices | Escribe Postgres | D1 prices repository + dry-run | Alta | refactorizar |
| `apps/web/src/lib/importers/benefits-csv.ts` | Prisma | Import benefits | Escribe Postgres | D1 benefits repository + dry-run | Alta | refactorizar |
| `apps/web/src/lib/importers/base-scholarships-csv.ts` | Prisma | Import becas base | Escribe Postgres | D1 scholarship repository | Alta | refactorizar |
| `apps/web/src/lib/importers/admin-import-sessions.ts` | Prisma | Sesiones import admin | DB externa | D1 import_job/import_issue | Alta | refactorizar |
| `apps/web/src/lib/d1/import-jobs.ts` | D1 prepared statements | Ledger inicial import jobs | Parcial, aun no conectado a todos los importadores | D1 + Queues | Alta | mantener |
| `apps/web/src/lib/d1/outbox.ts` | D1 prepared statements | Outbox inicial | Falta consumer/Queue | Queues + dead-letter | Media | mantener |
| `apps/web/src/lib/d1/quotes.ts` | D1 prepared statements | Sesiones/escenarios quote | Parcial | D1 quote repository completo | Alta | mantener |
| `apps/web/src/lib/d1/academic-offers.ts` | D1 prepared statements | Lectura ofertas | Solo read path parcial | D1 read/write repository | Alta | mantener |
| `apps/web/src/lib/file-assets.ts` | Prisma + D1 branch parcial | Metadata de archivos | Muchas operaciones aun Prisma | D1 file metadata + R2 binding | Alta | refactorizar |
| `apps/web/src/lib/r2-storage.ts` | Node crypto, env R2 S3 signing | URLs firmadas R2 via S3 API | Crypto Node y secretos en runtime; revisar compat Worker | R2 binding/Workers signing | Media | refactorizar |
| `apps/web/src/lib/r2-content-bucket.ts` | R2 public URL defaults | Listado/links de bucket | Defaults publicos pueden exponer activos | R2 privado/proxy segun tipo | Media | refactorizar |
| `apps/web/src/app/api/files/presigned-upload/route.ts` | R2/File auth | Upload firmado | Debe validar MIME/tamano y metadata D1 | R2 + D1 | Alta | refactorizar |
| `apps/web/src/app/api/files/[id]/download/route.ts` | File assets | Descarga archivo | Depende de metadata actual | R2 private signed/proxy | Alta | refactorizar |
| `apps/web/src/app/api/files/[id]/auth-view/route.ts` | File assets | Vista autenticada | Debe asegurar politicas privadas | R2 private signed/proxy | Alta | refactorizar |
| `apps/web/src/lib/quote-history.ts` | Prisma | Historial cotizacion | Prisma en ruta critica | D1 quote history | Alta | refactorizar |
| `apps/web/src/lib/scholarship-quote-service.ts` | Prisma | Calculo reglas beca | Ruta critica de cotizacion | D1 pricing/scholarship repositories | Alta | refactorizar |
| `apps/web/src/app/api/data/quote/route.ts` | Prisma types/events | API quote | Ruta productiva critica | D1 quote service | Alta | refactorizar |
| `apps/web/src/app/api/data/pricing-options/route.ts` | Prisma | Opciones pricing | Ruta productiva de precios | D1 pricing repository | Alta | refactorizar |
| `apps/web/src/app/api/public/costos/route.ts` | Prisma | Costos publicos | DB externa | D1 financial repository | Alta | refactorizar |
| `apps/web/src/app/api/public/oferta/route.ts` | Prisma | Oferta publica | DB externa | D1 academic offer repository | Alta | refactorizar |
| `apps/web/src/app/api/public/planes/route.ts` | Prisma | Planes publicos | DB externa | D1 academic offer/files | Alta | refactorizar |
| `apps/web/src/app/(admin)/admin/(protected)/prices/actions.ts` | Prisma | Admin precios | Writes Postgres | D1 prices repository | Alta | refactorizar |
| `apps/web/src/app/api/admin/prices/import/route.ts` | Prisma/import | Import precios | Write directo legacy | D1 import job + Queues | Alta | refactorizar |
| `apps/web/src/app/(admin)/admin/(protected)/benefits/actions.ts` | Prisma | Admin beneficios | Writes Postgres | D1 benefits repository | Alta | refactorizar |
| `apps/web/src/app/(admin)/admin/(protected)/oferta/actions.ts` | Prisma | Admin oferta | Writes Postgres | D1 academic offer repository | Alta | refactorizar |
| `apps/web/src/app/(admin)/admin/(protected)/unidep/fees/actions.ts` | Prisma | Admin costos | Writes Postgres | D1 financial repository | Alta | refactorizar |
| `apps/web/src/app/(admin)/admin/(protected)/users/actions.ts` | Prisma/Neon Auth relation | Admin usuarios | Auth/DB legacy | D1 auth/users repository | Alta | refactorizar |
| `apps/web/src/services/authSyncService.ts` | Prisma + Neon SQL | Sync auth | Une Neon y Prisma | D1 auth reconciler | Alta | refactorizar |
| `apps/web/src/lib/extension-runtime.ts` | Prisma | Extension runtime | DB externa para extension | D1 extension runtime repository | Alta | refactorizar |
| `apps/web/src/lib/extension-session-tokens.ts` | Prisma | Tokens extension | DB externa | D1 sessions/tokens | Alta | refactorizar |
| `apps/web/src/app/api/ext/campaigns/upload/route.ts` | Upload/campaign assets | Media extension | Requiere R2 + metadata segura | R2 + D1 | Media | refactorizar |
| `apps/web/src/lib/meta-whatsapp.ts` | Prisma + Meta APIs | WhatsApp integration | External API justificada, DB legacy | Adapter Worker + D1 state | Media | refactorizar |
| `apps/web/src/lib/google-integration.ts` | Prisma + Neon Auth vars | Google OAuth/sync | DB/auth legacy | D1 oauth + secrets Workers | Media | refactorizar |
| `apps/web/src/lib/web-push.ts` | Prisma + web-push | Push subscriptions | DB legacy; check Worker compat | D1 + Web Push adapter | Media | refactorizar |
| `packages/auth/src/permissions/capabilities.ts` | `@prisma/client` enum | Shared permissions | Pulls Prisma into shared package | Generated/shared enum independent | Alta | refactorizar |
| `packages/domain/src/import-export/import/import-job-service.ts` | `@/lib/prisma` | Domain package imports app DB | Cross-package boundary leak | Interface injected by app | Alta | refactorizar |
| `supabase/config.toml` | Supabase CLI/config | Legacy realtime project config | Maintains external provider | Retire after realtime cutover | Baja | retirar |
| `supabase/migrations/20260504202111_private_realtime_topics.sql` | Supabase SQL | Realtime topics | External provider schema | DO/D1 equivalent if needed | Baja | retirar |
| `scripts/export-cloudflare-d1-core.ts` | Prisma -> D1 export | Migration bridge | Reads Neon/Postgres | Manual dry-run/reconciler only | Alta | temporal |
| `scripts/seed_neon.js` | Neon | Seed legacy DB | Writes external DB | Retire after D1 cutover | Media | retirar |
| `scripts/verify_neon.js` | Neon | Verificacion legacy | External DB check | Replace with D1 health | Media | retirar |
| `scripts/apply_migrations_http.py` | Neon HTTP migrations | Applies Postgres migrations | External DB mutation | Retire after cutover | Alta | retirar |
| `scripts/prisma-env.js` | Prisma/DATABASE_URL | Prisma CLI helper | Legacy DB env | Retire after Prisma removal | Media | retirar |

## Rutas, actions y superficies

| Superficie | Evidencia | Riesgo | Destino | Prioridad | Accion |
| --- | --- | --- | --- | --- | --- |
| Rutas API publicas Recalc | `apps/web/src/app/api/public/recalc/**` | Varias importan Prisma enums/services | D1 public repositories | Alta | refactorizar |
| Admin protected pages/actions | `apps/web/src/app/(admin)/admin/(protected)/**` | Muchas Server Actions importan Prisma | D1 admin repositories | Alta | refactorizar |
| Auth routes | `apps/web/src/app/api/auth/**`, `apps/web/src/app/(public)/auth/**` | Neon Auth activo | D1/Workers auth | Alta | refactorizar |
| Files routes | `apps/web/src/app/api/files/**` | R2 parcial + Prisma metadata | R2 private + D1 metadata | Alta | refactorizar |
| Import routes | `apps/web/src/app/api/admin/**/import/**`, `apps/web/src/app/api/public/recalc/importers/**` | Write paths legacy | D1 jobs + Queues + dry-run | Alta | refactorizar |
| Webhooks | `api/integrations/neon-auth`, `api/integrations/meta/webhook` | Idempotency/adapters pendientes | D1 idempotency/outbox | Media | refactorizar |
| Inbox/capacitacion realtime | `api/unidep/inbox/**`, `api/capacitacion/**` | Supabase realtime | DO only if required | Media | refactorizar |
| GitHub/admin integrations | `api/admin/github/**`, `api/public/recalc/github/**` | External API but intentional | Adapter interface + secrets | Baja | mantener |
| Meta/WhatsApp integrations | `api/integrations/meta/**` | External API justified | Worker-compatible adapter | Media | refactorizar |
| Google integrations | `api/integrations/google/**`, `packages/domain/src/google/**` | OAuth secrets and DB state | D1 oauth + adapter | Media | refactorizar |

## Hallazgos por prioridad

Alta:

- Prisma sigue en 243 archivos runtime o paquetes.
- `apps/web/src/lib/cloudflare/prisma.ts` aun instancia `PrismaClient`.
- El workflow manual `APLICAR` debe quedar protegido por environment antes de usarse.
- Auth depende de Neon Auth.
- Imports criticos de precios, becas y oferta aun escriben con Prisma.
- Metadata de archivos depende ampliamente de Prisma.

Media:

- Supabase Realtime esta concentrado, pero toca inbox y capacitacion.
- Nodemailer requiere reemplazo/adaptador Worker.
- R2 tiene rutas con defaults publicos que deben revisarse por privacidad.
- Workflows legacy de Vercel/Neon deben retirarse solo con reemplazo documentado.

Baja:

- Supabase config/migration puede permanecer como referencia historica hasta cutover.
- Vercel references en tests del SDK pueden cambiar despues del dominio final.

## Acciones inmediatas recomendadas

1. Crear auditoria D1 READONLY con confirmacion `READONLY` y artifact descargable.
2. Migrar cotizacion a un repository D1 completo y reemplazar `quote-history`/`scholarship-quote-service` en rutas criticas.
3. Reemplazar `apps/web/src/lib/cloudflare/prisma.ts` por facade D1 o eliminar el alias al cerrar imports.
4. Completar metadata de archivos en D1 antes de tocar rutas de upload/download.
5. Decidir auth antes de retirar Neon Auth UI/admin.
6. Decidir realtime despues de medir si inbox/capacitacion necesitan presencia/coordinacion real.
