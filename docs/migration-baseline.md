# Linea base de migracion

Fecha: 2026-07-10  
Rama: `migration/vercel-supabase`  
Base: `origin/main` en `0e797489ef1bb8e64cb278ce52b6bdf06a71a744`  
Gestor de paquetes detectado: npm (`packageManager`: `npm@11.12.1`, lockfile `package-lock.json`)

## Contexto

La linea base se ejecuto despues de crear la rama y de agregar `docs/migration-audit.md`. No habia cambios de codigo antes de estas validaciones. No se leyeron ni imprimieron archivos `.env*`.

Versiones:

```text
node: v24.15.0
npm: 11.12.1
```

## Resumen

| Validacion | Comando | Resultado | Duracion aprox. | Paquetes/superficie | Observaciones |
| --- | --- | --- | --- | --- | --- |
| install | `npm ci --foreground-scripts` | Pasa | `10:48.54` | repo completo | Warnings de paquetes deprecated; warning transitorio de Prisma schema default; postinstall raiz genera Prisma desde `packages/db/prisma/schema.prisma`. |
| lint | `npm run lint` | Falla | `0:59.24` | `apps`, `packages`, `scripts` | Warning tratado como error: import typo `createCampagn` sin uso. |
| typecheck | `npm run typecheck` | Falla | `3:18.25` | repo completo | Error TS por `createCampagn`/`createCampaign` en optional sender. |
| test | `npm test` | Pasa | `0:26.70` | Vitest | 95 archivos, 367 tests pasados. |
| build | `npm run build` | Falla | `0:27.56` | build raiz Cloudflare/OpenNext | Falla antes de OpenNext porque `build-cloudflare.mjs` ejecuta typecheck y encuentra el mismo error TS. |
| build Next adicional | `npm run build:next` | Falla | `3:09.70` | Next.js estandar | Next inicia compilacion y emite warnings Sentry; proceso termina con exit 137 `Killed`. |

## Salidas relevantes

### Install

```text
added 1233 packages, and audited 1241 packages in 11m
found 0 vulnerabilities
duration=10:48.54 exit=0
```

Warnings relevantes:

```text
npm warn deprecated rimraf@2.7.1
npm warn deprecated lodash.isequal@4.5.0
npm warn deprecated inflight@1.0.6
npm warn deprecated glob@7.2.3
npm warn deprecated @react-email/* packages
npm warn deprecated fstream@1.0.12
npm warn deprecated node-domexception@1.0.0
npm warn deprecated glob@9.3.5
prisma:warn We could not find your Prisma schema in the default locations
```

El postinstall raiz si genero el cliente correcto:

```text
> relead-recalc-platform@0.1.0 postinstall
> prisma generate --schema packages/db/prisma/schema.prisma

Prisma schema loaded from packages/db/prisma/schema.prisma
Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client
```

### Lint

```text
/home/ricardo/dev/Scholarship-Cloudflare/apps/web/src/app/api/public/campaigns/optional-sender/route.ts
  5:3  warning  'createCampagn' is defined but never used. Allowed unused vars must match /^_/u  @typescript-eslint/no-unused-vars

ESLint found too many warnings (maximum: 0).
duration=0:59.24 exit=1
```

### Typecheck

```text
apps/web/src/app/api/public/campaigns/optional-sender/route.ts(5,3): error TS2724: '"@/lib/public-campaign-sender"' has no exported member named 'createCampagn'. Did you mean 'createCampaign'?
apps/web/src/app/api/public/campaigns/optional-sender/route.ts(43,26): error TS2552: Cannot find name 'createCampaign'. Did you mean 'createCampagn'?
duration=3:18.25 exit=2
```

### Tests

```text
Test Files  95 passed (95)
Tests       367 passed (367)
Duration    25.21s
duration=0:26.70 exit=0
```

### Build raiz actual

El script raiz actual no es Next estandar; ejecuta Cloudflare:

```text
> relead-recalc-platform@0.1.0 build
> npm run build:cloudflare
```

Falla por el typecheck preexistente:

```text
[cloudflare-build] Running repository typecheck before OpenNext build.
apps/web/src/app/api/public/campaigns/optional-sender/route.ts(5,3): error TS2724: '"@/lib/public-campaign-sender"' has no exported member named 'createCampagn'. Did you mean 'createCampaign'?
apps/web/src/app/api/public/campaigns/optional-sender/route.ts(43,26): error TS2552: Cannot find name 'createCampaign'. Did you mean 'createCampagn'?
duration=0:27.56 exit=1
```

### Build Next estandar adicional

```text
> @relead/web@0.1.0 build
> next build --webpack

Next.js 16.2.6 (webpack)
Creating an optimized production build ...
```

Warnings Sentry preexistentes:

```text
[@sentry/nextjs] It appears you've configured a `sentry.server.config.ts` file. Please ensure to put this file's content into the `register()` function of a Next.js instrumentation file instead.
[@sentry/nextjs] Could not find a Next.js instrumentation file.
[@sentry/nextjs] It appears you've configured a `sentry.edge.config.ts` file.
```

Fallo:

```text
Killed
npm error code 137
duration=3:09.70 exit=137
```

## Errores preexistentes

| Area | Archivo | Error | Impacto |
| --- | --- | --- | --- |
| Lint/typecheck/build | `apps/web/src/app/api/public/campaigns/optional-sender/route.ts` | Import typo `createCampagn` vs `createCampaign` | Bloquea lint, typecheck y build raiz. |
| Build Next estandar | `apps/web` | `next build --webpack` termina con `Killed` exit 137 | Bloquea validacion Next estandar; probable limite de memoria/proceso durante compilacion. |
| Sentry config | `apps/web/sentry.server.config.ts`, `apps/web/sentry.edge.config.ts` | Warnings por falta de instrumentation file | No bloquea por si solo, pero debe revisarse antes de Vercel. |

## Errores provocados por la migracion

Ninguno registrado en esta fase. Todavia no se hicieron cambios estructurales ni de codigo de migracion.

## Pruebas no ejecutables por falta de servicios externos

No se ejecutaron validaciones remotas contra Cloudflare, Vercel ni Supabase staging. Esta fase fue local y no destructiva.

Validaciones remotas pendientes:

- Supabase staging migrations.
- Supabase Auth callbacks.
- Supabase Realtime real.
- Supabase Storage upload/download.
- Vercel Preview Deployment.
- Cloudflare produccion: no se toco ni se valido en escritura.

## Decision para la siguiente fase

Antes de cambios estructurales conviene corregir el typo `createCampagn` en un commit separado o documentarlo como preexistente permanente. Como bloquea typecheck/build, sera necesario resolverlo para validar la migracion. El fallo exit 137 de `next build` requiere diagnostico despues de desacoplar OpenNext/Cloudflare y simplificar config de build.
