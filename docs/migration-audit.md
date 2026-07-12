# Auditoria de migracion Vercel + Supabase

Fecha: 2026-07-10  
Rama: `migration/vercel-supabase`  
Base auditada: `origin/main` en `0e797489ef1bb8e64cb278ce52b6bdf06a71a744`

## Alcance

Esta auditoria cubre la migracion de `Scholarship-Cloudflare` desde la ruta Cloudflare Workers/OpenNext/D1/R2 hacia una aplicacion Next.js estandar desplegable en Vercel con Supabase PostgreSQL, Supabase Auth, Supabase Realtime y Supabase Storage.

No se inspeccionaron ni imprimieron archivos `.env*` con secretos. En el checkout actual no hay `.env.example` ni `apps/web/.env.example`.

## Comandos de inspeccion usados

```bash
git status --short --branch
git fetch origin main --prune
find . -maxdepth 3 -type f \( -name 'package.json' -o -name 'package-lock.json' -o -name 'turbo.json' -o -name 'next.config.*' -o -name 'wrangler.*' -o -name 'open-next.config.*' -o -name 'vercel.json' \) -print | sort
git grep -n -I -E "cloudflare|wrangler|open-next|opennext|D1|R2|KV|DurableObject|caches\.default|env\.DB|env\.BUCKET|getCloudflareContext|workerd" -- package.json apps packages scripts .github supabase docs ':!package-lock.json'
git grep -n -I -E "outbox_event|broadcast|postgres_changes|SUPABASE|DATABASE_URL|DIRECT_URL|NEXT_RUNTIME|runtime = ['\"]edge|export const runtime" -- package.json apps packages scripts .github supabase docs ':!package-lock.json'
grep -nE "^(model|enum) " packages/db/prisma/schema.prisma
grep -RInE "^CREATE TABLE|^CREATE INDEX|^ALTER TABLE|^CREATE UNIQUE INDEX" apps/web/migrations supabase/migrations packages/db/prisma/migrations
```

`rg` no esta instalado en este host; se uso `git grep`, `grep` y `find`.

## Arquitectura actual

El repositorio es un monorepo npm con workspaces `apps/*` y `packages/*`. La aplicacion principal esta en `apps/web` y usa Next.js App Router.

La ruta principal de build esta orientada a Cloudflare:

- `package.json` define `build` como `npm run build:cloudflare`.
- `apps/web/package.json` define `build:cloudflare`, `prepare:cloudflare`, `preview:cloudflare`, `deploy:cloudflare` y comandos D1 con Wrangler.
- `apps/web/open-next.config.ts` importa `@opennextjs/cloudflare`.
- `apps/web/wrangler.jsonc` define Worker, assets OpenNext, D1 `DB`/`MYSQL` y R2 `Assets`.
- `.github/workflows/cloudflare-preflight.yml` y `.github/workflows/cloudflare-workers.yml` producen y despliegan artefactos OpenNext.

La persistencia actual esta dividida:

- Prisma/PostgreSQL en `packages/db/prisma/schema.prisma`, esquema `recalc_admin`, con muchas migraciones historicas.
- D1/SQLite en `apps/web/migrations`, con tablas de auth Cloudflare, organizaciones, import jobs, conversaciones, outbox, quote history, extension runtime y Campaign Sender.
- Supabase local en `supabase/` existe, pero solo contiene config local y una migracion para politicas de `realtime.messages`; no es la fuente de verdad del dominio.

La autenticacion actual tambien esta dividida:

- Neon Auth / Better Auth en `apps/web/src/lib/auth/server.ts`, `apps/web/src/lib/auth/client.ts` y `apps/web/middleware.ts`.
- Auth Cloudflare/D1 en `apps/web/src/lib/cloudflare/auth.ts` y rutas `api/auth/sign-in`, `api/auth/sign-up`, `api/admin/sign-in`.
- Autorizacion de dominio en `packages/auth` y helpers dentro de `apps/web/src/lib/authz.ts`, `admin-session.ts`, `admin-capabilities.ts`, etc.

Realtime existe como transporte Supabase parcial:

- Cliente browser en `apps/web/src/lib/supabase/client.ts`.
- Broadcast server en `apps/web/src/lib/supabase/server-realtime.ts`.
- Tokens privados en `apps/web/src/lib/realtime-token.ts` y `apps/web/src/app/api/realtime/token/route.ts`.
- En Cloudflare se deriva a `outbox_event` mediante D1; fuera de Cloudflare usa RPC `broadcast` con `SUPABASE_SERVICE_ROLE_KEY`.

Storage actual usa R2:

- Binding Cloudflare R2 en `apps/web/src/lib/cloudflare/r2.ts`.
- S3-compatible R2 presigned URLs en `apps/web/src/lib/r2-storage.ts`.
- Content bucket R2 con defaults historicos en `apps/web/src/lib/r2-content-bucket.ts`.
- UI y rutas de archivos hablan de "R2" en `apps/web/src/app/(admin)/admin/(protected)/files`, programas, formatos e importaciones.

## Dependencias Cloudflare detectadas

- Paquetes: `@opennextjs/cloudflare`, `wrangler`.
- Config: `apps/web/open-next.config.ts`, `apps/web/wrangler.jsonc`.
- Scripts: `build:cloudflare`, `preview:cloudflare`, `deploy:cloudflare`, `d1:*`.
- CI/CD: Cloudflare preflight, Worker deploy, D1 migrations/readiness.
- Runtime: `getCloudflareContext`, D1 adapters bajo `apps/web/src/lib/cloudflare/*`, D1 helpers bajo `apps/web/src/lib/d1/*`.
- Storage: R2 binding `Assets`, R2 S3 credentials, public R2 URLs.
- Realtime bridge: `outbox_event` y D1 outbox para eventos que se querian emitir hacia Supabase.

No se encontraron rutas activas con `export const runtime = "edge"`. Se encontraron 115 rutas con `export const runtime = "nodejs"`, lo cual favorece Vercel Serverless/Node para Prisma, Supabase SSR y drivers PostgreSQL.

## Componentes reutilizables

- UI y App Router en `apps/web/src/app`, `apps/web/src/components` y `packages/ui`.
- Reglas de negocio y normalizadores en `packages/domain` y `apps/web/src/lib/*` que no dependan directamente de D1/R2/Neon Auth.
- Autorizacion por permisos/capabilities en `packages/auth`.
- Modelo Prisma/PostgreSQL como referencia rica para convertir a `supabase/migrations`.
- Pruebas Vitest y Playwright existentes.
- Supabase Realtime client-side existente como base conceptual, reemplazando Broadcast manual por canales nativos adecuados.

## Componentes que deben reemplazarse o aislarse

- OpenNext/Wrangler como ruta de build y deploy.
- `apps/web/src/lib/cloudflare/*` en la ruta principal.
- `apps/web/src/lib/d1/*` como capa de persistencia principal.
- Auth Neon/Better Auth y auth Cloudflare/D1 por Supabase Auth SSR.
- RPC broadcast con `SUPABASE_SERVICE_ROLE_KEY` para flujo normal de usuario.
- Storage R2 por Supabase Storage con politicas RLS sobre `storage.objects`.
- Workflows Cloudflare activos para la nueva rama; deben quedar documentados como produccion legacy, no como camino Vercel.

## Riesgos

- La app tiene dos modelos de datos parcialmente divergentes: Prisma/Postgres y D1/SQLite.
- Hay tablas D1 duplicadas por prefijo (`0003`, `0004`) y migraciones historicas ya conocidas.
- El build Vercel actual ejecuta migraciones Prisma en `scripts/vercel-build.sh`; eso no debe continuar como mecanismo automatico de cambio de schema.
- Supabase Realtime actual usa `service_role` en servidor para broadcast; debe quedar fuera del flujo cliente y limitarse a tareas administrativas si se conserva.
- Storage contiene defaults R2 publicos historicos; deben eliminarse para evitar acoplamiento accidental.
- RLS no esta implementado como fuente completa de seguridad de dominio en Supabase.
- La migracion real de datos requiere credenciales de staging; si no existen, solo se podran validar scripts dry-run/locales.
- La extension Chrome y los flujos Meta/Google pueden depender de tokens, callbacks y contratos existentes; hay que migrarlos incrementalmente.

## Dependencias bloqueantes

- Credenciales Supabase staging para validar migraciones remotas, RLS, Auth URLs, Storage y Realtime.
- Configuracion Vercel Preview para validar deployment real.
- Decision de fuente de verdad de schema: recomendada `supabase/migrations`, migrando desde Prisma y D1.
- Mapeo de usuarios: `recalc_admin.user`, D1 `cloudflare_auth_user` y `auth.users`.
- Politicas de buckets Storage y convencion final de paths.
- Inventario de datos productivos a exportar desde D1/R2 sin tocar produccion.

## Estrategia de migracion

1. Congelar linea base con `npm ci`, lint, typecheck, tests y build actual.
2. Cambiar la ruta de build local/preview a Next.js estandar (`next build`) sin tocar workflows productivos Cloudflare de `main`.
3. Convertir `supabase/migrations` en fuente de verdad SQL para staging.
4. Mantener Prisma temporalmente solo como cliente/contrato si reduce riesgo, pero no como sistema activo de migracion a largo plazo.
5. Introducir clientes Supabase unicos para browser, server, middleware y admin seguro.
6. Migrar auth a Supabase Auth SSR y mantener autorizacion en tablas de dominio.
7. Reemplazar rutas D1 por repositorios PostgreSQL/Supabase.
8. Reemplazar Broadcast/outbox realtime por `postgres_changes` para datos persistentes y Broadcast/Presence solo donde sean eventos efimeros/presencia.
9. Crear abstraccion de storage y backend Supabase Storage.
10. Preparar Vercel con deteccion automatica Next.js, variables documentadas y Preview Deployments.
11. Validar localmente y documentar cualquier validacion remota no ejecutada.

## Orden recomendado de cambios

1. Auditoria y baseline.
2. Plan tecnico detallado y commits por fase.
3. Build Next.js estandar y retiro de OpenNext/Wrangler de la ruta default.
4. Env validation y clientes Supabase.
5. Supabase SQL base con RLS.
6. Auth middleware/callback/session.
7. Repositorios PostgreSQL para rutas criticas.
8. Realtime nativo.
9. Storage.
10. Tests y docs finales.

## Matriz de archivos afectados

| Archivo | Responsabilidad | Dependencia actual | Accion | Reemplazo | Riesgo | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| `package.json` | Scripts raiz y dependencias | `build:cloudflare`, OpenNext, Wrangler, Neon Auth, Prisma | Cambiar build default a Next/Vercel y retirar scripts Cloudflare de ruta principal | `npm --workspace @relead/web run build`, scripts legacy aislados | Alto | Pendiente |
| `apps/web/package.json` | Scripts app web | `build:cloudflare`, `wrangler`, D1 commands | Mantener `build` como `next build`, mover comandos Cloudflare a legacy docs/scripts si se conservan | Next.js estandar | Alto | Pendiente |
| `package-lock.json` | Lock npm | OpenNext/Wrangler/Neon actuales | Actualizar tras cambios de dependencias | Lock npm coherente | Medio | Pendiente |
| `turbo.json` | Pipeline monorepo | Env `NEON_*`, `SUPABASE_*`, `DATABASE_URL` | Ajustar envs a Supabase/Vercel reales | `NEXT_PUBLIC_SUPABASE_*`, `DATABASE_URL`, `DIRECT_URL` | Medio | Pendiente |
| `apps/web/next.config.ts` | Config Next | R2 hostname, `CLOUDFLARE_BUILD`, shims OpenNext | Retirar aliases Cloudflare y R2 remote pattern historico | Config Next/Vercel simple | Alto | Pendiente |
| `apps/web/open-next.config.ts` | OpenNext Cloudflare | `@opennextjs/cloudflare` | Mover a `legacy/cloudflare/` o eliminar de ruta build | Documentacion legacy | Bajo | Pendiente |
| `apps/web/wrangler.jsonc` | Worker/D1/R2 bindings | Worker, D1, R2 | Mover a `legacy/cloudflare/` o dejar solo como referencia documentada | Vercel Project Settings | Bajo | Pendiente |
| `.github/workflows/cloudflare-preflight.yml` | Preflight Worker | OpenNext/Wrangler | Mantener para produccion legacy en `main`, no usar para rama Vercel | Vercel Preview via Git | Medio | Pendiente |
| `.github/workflows/cloudflare-workers.yml` | Deploy produccion Cloudflare | Worker deploy | No tocar produccion; documentar rollback | Vercel preview separado | Alto | Pendiente |
| `.github/workflows/cloudflare-d1-migrations.yml` | D1 remoto | Wrangler D1 apply | No ejecutar; aislar como legacy | Supabase migrations staging | Alto | Pendiente |
| `scripts/vercel-build.sh` | Build Vercel historico | Prisma migrate deploy, Neon fallbacks | Eliminar migraciones de build y simplificar | `next build` sin mutacion DB | Critico | Pendiente |
| `packages/db/prisma/schema.prisma` | Modelo Postgres actual | Prisma migrations en `recalc_admin` | Usar como referencia o cliente temporal, no doble fuente de migracion | `supabase/migrations` | Alto | Pendiente |
| `packages/db/src/client.ts` | Prisma client singleton | Inicializa DB en module scope | Cambiar a lazy getter si se conserva Prisma | `getPrisma()`/Supabase server DB | Alto | Pendiente |
| `packages/db/src/db-url.ts` | Resolucion DB | Fallback local automatico y Neon aliases | Validacion explicita de env | Env typed validation | Medio | Pendiente |
| `apps/web/migrations/*.sql` | Schema D1 | SQLite/D1 | Inventariar y convertir a Postgres | `supabase/migrations` | Alto | Pendiente |
| `supabase/config.toml` | Supabase local | Config generica; seed faltante referenciado | Ajustar a staging/local y buckets necesarios | Supabase CLI config validada | Medio | Pendiente |
| `supabase/migrations/20260504202111_private_realtime_topics.sql` | RLS realtime Broadcast/Presence | Private topics por JWT custom | Revisar si se mantiene para Broadcast/Presence | RLS + postgres_changes publication | Medio | Pendiente |
| `apps/web/middleware.ts` | Proteccion rutas | Neon Auth cookies y middleware | Reemplazar por Supabase SSR cookie refresh | Supabase middleware client | Alto | Pendiente |
| `apps/web/src/lib/auth/server.ts` | Auth server | `@neondatabase/auth` | Reemplazar por Supabase server helpers | `createServerClient` | Alto | Pendiente |
| `apps/web/src/lib/auth/client.ts` | Auth cliente | Neon Auth client | Reemplazar por Supabase browser client | `createBrowserClient` | Alto | Pendiente |
| `apps/web/src/lib/cloudflare/auth.ts` | Auth D1/Cloudflare | `getCloudflareContext`, D1 sessions, password hash | Retirar de ruta principal | Supabase Auth + profiles | Alto | Pendiente |
| `apps/web/src/lib/cloudflare/d1.ts` | D1 binding | `getCloudflareContext().env.DB` | Retirar de ruta principal | PostgreSQL/Supabase repos | Alto | Pendiente |
| `apps/web/src/lib/d1/*` | Repositorios D1 | SQL SQLite, outbox | Convertir o reemplazar por repos Postgres | SQL/PostgREST/Supabase | Alto | Pendiente |
| `apps/web/src/app/api/auth/*` | Sign-in/sign-up | Cloudflare auth + Neon auth mixed | Migrar a Supabase Auth callback/actions | `/auth/callback`, Supabase SSR | Alto | Pendiente |
| `apps/web/src/app/(app)/layout.tsx` | Layout protegido | Cloudflare runtime/auth branch | Usar `getCurrentUser` Supabase | Supabase session + memberships | Alto | Pendiente |
| `apps/web/src/app/(admin)/admin/(protected)/layout.tsx` | Admin protected shell | Prisma/auth helpers | Revalidar contra Supabase session + RBAC | Supabase Auth + `organization_members` | Alto | Pendiente |
| `packages/auth/src/permissions/*` | Permisos | Reutilizable, no provider-specific | Mantener y conectar a membership/roles | Supabase-backed RBAC | Medio | Reutilizable |
| `apps/web/src/lib/supabase/client.ts` | Realtime browser | Broadcast/Presence custom tokens | Migrar datos persistentes a `postgres_changes` | Supabase Realtime native | Medio | Pendiente |
| `apps/web/src/lib/supabase/server-realtime.ts` | Broadcast server | `SUPABASE_SERVICE_ROLE_KEY` + RPC `broadcast`, D1 outbox | Retirar de flujo normal; conservar solo admin si necesario | DB writes + `postgres_changes` | Alto | Pendiente |
| `apps/web/src/lib/realtime-token.ts` | JWT private topics | `SUPABASE_REALTIME_JWT_SECRET` | Evitar si `postgres_changes` con RLS basta; conservar para Presence/Broadcast privado | Supabase Auth session | Medio | Pendiente |
| `packages/realtime/src/*` | Servicios realtime | Imports con alias app y Broadcast | Desacoplar paquete de `@/lib`, usar Supabase client injectable | Native channels | Medio | Pendiente |
| `apps/web/src/hooks/useRealtimeMessages.ts` | Mensajes realtime UI | Broadcast | Migrar a `postgres_changes` filtrado por thread/org | Channel filtered | Medio | Pendiente |
| `apps/web/src/hooks/useRealtimePresence.ts` | Presencia UI | Supabase Presence | Mantener, autorizando canales | Presence con cleanup | Medio | Pendiente |
| `apps/web/src/lib/r2-storage.ts` | Presigned uploads/downloads R2 | R2 S3 credentials | Reemplazar por adapter storage | Supabase Storage signed URLs | Alto | Pendiente |
| `apps/web/src/lib/r2-content-bucket.ts` | Content bucket publico | R2 defaults publicos | Reemplazar por bucket `documents`/`imports` segun uso | Supabase Storage | Alto | Pendiente |
| `apps/web/src/lib/cloudflare/r2.ts` | R2 binding Worker | `getCloudflareContext().env.Assets` | Retirar de ruta principal | Storage adapter server | Alto | Pendiente |
| `apps/web/src/app/api/files/*` | File APIs | R2 presign y metadata Prisma | Reemplazar backend por Supabase Storage + DB metadata | Storage adapter + RLS | Alto | Pendiente |
| `apps/web/src/app/(admin)/admin/(protected)/files/*` | UI archivos | Textos/acciones R2 | Actualizar copy y acciones a Storage | Supabase Storage | Medio | Pendiente |
| `apps/web/src/app/api/ext/campaigns/upload/route.ts` | Upload extension | R2 o Cloudinary fallback | Usar Storage o conservar Cloudinary si justificado | Supabase Storage bucket `attachments` | Alto | Pendiente |
| `apps/web/src/app/api/content-bucket/[...key]/route.ts` | Proxy content bucket | R2 content bucket | Reemplazar por signed/public Storage | Supabase Storage | Alto | Pendiente |
| `docs/CLOUDFLARE_MIGRATION.md` | Docs historicas | Cloudflare target anterior | Mantener como legacy/rollback | Nuevos docs Vercel/Supabase | Bajo | Historico |
| `docs/realtime-architecture.md` | Realtime docs | Broadcast privado | Actualizar a native Supabase Realtime | New realtime migration doc | Medio | Pendiente |
| `README.md` | Instrucciones repo | Estado anterior | Actualizar quickstart Vercel/Supabase | README migrado | Medio | Pendiente |

## Decision inicial

La migracion debe partir de una rama aislada y conservar Cloudflare como produccion legacy hasta que exista una Preview Vercel validada con Supabase staging. No se debe ejecutar `wrangler deploy`, `wrangler d1 migrations apply`, cambios DNS ni migraciones destructivas remotas durante esta rama.
