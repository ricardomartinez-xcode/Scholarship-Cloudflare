# Cloudflare D1 y Campaign Sender - handoff

Fecha: 2026-07-03

Rama de trabajo: `codex/cloudflare-d1-campaign-runtime`

## Diagnostico ejecutado

- `node --version`: `v24.15.0` en la maquina local. Los workflows siguen en Node 22.
- `npm --version`: `11.12.1`.
- `npm ci --foreground-scripts`: correcto; Prisma Client se genero durante `postinstall`.
- `npm run check`: antes fallaba porque el script no existia. Se agrego como `npm run lint && npm run typecheck && npm test`.
- `npm test`: baseline correcto antes de cambios.
- `npm run build:cloudflare`: baseline fallaba por tipos en `extension-campaign-template` al recibir `JsonValue`.
- `npm run d1:migrations:list` y `npm run d1:tables`: no ejecutables en esta sesion porque Wrangler requiere `CLOUDFLARE_API_TOKEN` en entorno no interactivo. No se usaron tokens temporales.

## Causas raiz corregidas

- CI dependia de la version npm implicita de `actions/setup-node`, aunque `package.json` exige `npm@11.12.1`.
- `npm run check` no existia, pero el runbook lo exigia como gate local.
- `npm run build:cloudflare` fallaba por un tipo demasiado estrecho en templates de Campaign Sender.
- `/api/data/simulador` tenia `runtime = "nodejs"` y su `POST` delegaba siempre a `/api/data/quote-history`, que usa Prisma.
- Inbox creaba mensajes en D1 pero despues intentaba resolver destinatarios y Web Push con servicios Prisma dentro del runtime Cloudflare.
- `pricing-options`, `benefits`, inbox y media de campañas tenian rutas D1, pero aun podian arrastrar servicios Prisma por imports top-level en ramas no-Cloudflare.
- `/api/admin/d1-diagnostics` no validaba todas las tablas requeridas por assets, Campaign Sender y extension runtime.
- El panel `/admin/campaign-sender` leia las tablas `campaign_sender_*`, mientras la extension MV3 real usa `/api/ext/campaigns` con `extension_campaign` y `extension_campaign_recipient`.
- `/admin/campaign-sender` no tenia capacidad de ruta explicita y heredaba la regla generica de `/admin`.

## Rutas migradas o reforzadas

- `/api/data/benefits`: usa D1 en Cloudflare y carga el resolver Prisma solo fuera del Worker.
- `/api/data/pricing-options`: usa D1 para overrides, campus, oferta activa, catalogo y assets R2 en Cloudflare; captura fallos de storage como `503`.
- `/api/data/simulador`: `GET` lista sesiones desde D1 y `POST` guarda autosaves/snapshots en `quote_session`, `quote_scenario` y `quote_event` sin delegar a Prisma en Cloudflare.
- `/api/unidep/inbox/threads`: lista y crea hilos con D1 en Cloudflare; los servicios Prisma son imports dinamicos solo fuera del Worker.
- `/api/unidep/inbox/threads/[threadId]`: renombra, archiva y elimina con D1 en Cloudflare; errores de storage se reportan como `503`.
- `/api/unidep/inbox/threads/[threadId]/messages`: lista y crea mensajes con D1 en Cloudflare; no llama Web Push Prisma en el Worker.
- `/api/ext/campaigns/media`: descarga desde R2/D1 en Cloudflare; Prisma queda solo para la rama legacy no-Cloudflare.
- `/api/admin/d1-diagnostics`: protegido por `view_admin_operations`; reporta solo estado, tablas presentes/faltantes y timestamp.
- `/admin/campaign-sender`: ahora muestra estado de backend/extension/campanas desde `extension_campaign`, `extension_campaign_recipient` y eventos de runner.

## Tablas D1 requeridas

El preflight y el diagnostico admin validan:

- Core academico: `campus`, `program`, `program_offering`, `academic_fee`, `campus_academic_fee`, `admin_price_override`.
- Beneficios: `admin_additional_benefit`, `admin_additional_benefit_campus`.
- Assets: `file_asset`, `file_asset_usage`.
- Auth Cloudflare: `cloudflare_auth_user`, `cloudflare_auth_session`.
- Organizaciones/imports: `organization`, `import_job`, `oauth_connection`.
- Simulador: `quote_session`, `quote_scenario`, `quote_event`.
- Inbox: `conversation`, `conversation_member`, `conversation_message`.
- Extension runtime: `business_event`, `extension_campaign`, `extension_campaign_recipient`, `outbox_event`.
- Campaign Sender legacy/public: `campaign_sender_profile`, `campaign_sender_campaign`, `campaign_sender_recipient`, `campaign_sender_event`.

## Migraciones

No se renombraron migraciones existentes.

Duplicados detectados y conservados:

- `0003_extension_session_tokens.sql`
- `0003_organizations_and_audit.sql`
- `0004_extension_runtime_and_quote.sql`
- `0004_quote_history.sql`

Migraciones locales relevantes:

- `0001_recalc_core.sql`: core academico, assets, usuarios y sesiones Cloudflare.
- `0003_extension_session_tokens.sql`: tokens/sesiones de extension.
- `0004_extension_runtime_and_quote.sql`: `business_event`, `extension_campaign`, `extension_campaign_recipient`, beneficios D1.
- `0004_quote_history.sql`: historial del simulador.
- `0011_campaign_sender_extension.sql`: tablas `campaign_sender_*`.

Si el remoto reporta tablas faltantes, crear una migracion nueva con prefijo unico y ordenable, sin renombrar archivos aplicados. Usar `CREATE TABLE IF NOT EXISTS`, indices `IF NOT EXISTS` y cambios idempotentes.

## Comandos de migracion y deploy

No ejecutar sin aprobacion explicita:

```bash
npm run d1:migrations:list
npm run d1:tables
cd apps/web
npx wrangler d1 migrations apply recalc-cloudflare --remote
cd ../..
npm run d1:tables
```

Despues de aplicar migraciones, validar:

```bash
npm run d1:migrations:list
npm run d1:tables
npm run build:cloudflare
```

Tambien revisar `/api/admin/d1-diagnostics` desde una sesion admin con capacidad `view_admin_operations`.

## Riesgos pendientes

- La comparacion remota de esquema no se pudo completar localmente por falta de `CLOUDFLARE_API_TOKEN`.
- Aun existen muchas rutas explicitamente `runtime = "nodejs"` para flujos admin, imports, archivos, integraciones y APIs publicas ReCalc. No fueron migradas en esta rama.
- El panel Campaign Sender reporta `sent` como "WhatsApp Web acepto el intento". Delivery/read requieren WhatsApp Business API y webhooks.
- Las tablas `campaign_sender_*` siguen existiendo para endpoints publicos legacy; la UI admin principal queda conectada al backend real de la extension.
